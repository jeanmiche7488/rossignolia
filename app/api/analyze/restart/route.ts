import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createServerComponentClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'ID d\'analyse requis' }, { status: 400 });
    }

    // Get user profile to check tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Use service role client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get analysis to verify ownership
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });
    }

    // Check if user has permission (must be from same tenant or SUPER_ADMIN)
    if (profile.role !== 'SUPER_ADMIN' && analysis.tenant_id !== profile.tenant_id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Check if analysis has files
    const { data: analysisFiles } = await supabaseAdmin
      .from('analysis_files')
      .select('*')
      .eq('analysis_id', analysisId);

    if (!analysisFiles || analysisFiles.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier trouvé pour cette analyse' }, { status: 400 });
    }

    // Delete existing results (recommendations and stock entries) to start fresh
    await supabaseAdmin
      .from('recommendations')
      .delete()
      .eq('analysis_id', analysisId);

    await supabaseAdmin
      .from('stock_entries')
      .delete()
      .eq('analysis_id', analysisId);

    // Reset analysis status and clear previous mapping/results
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'pending',
        mapped_columns: null,
        original_columns: null,
        metadata: {
          ...(analysis.metadata as any || {}),
          restarted_at: new Date().toISOString(),
          restarted_by: user.id,
        },
      })
      .eq('id', analysisId);

    // Trigger mapping phase again
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze/map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ analysisId }),
    }).catch((err) => {
      console.error('Failed to trigger mapping phase:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Analyse relancée. Vous serez redirigé vers la page de confirmation du mapping.',
      requiresMappingConfirmation: true,
    });
  } catch (error) {
    console.error('Restart analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
