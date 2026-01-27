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

    // Get analysis
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });
    }

    console.log('[Start] Démarrage de l\'analyse:', analysisId);
    console.log('[Start] Déclenchement de la phase de mapping (asynchrone)...');
    
    // Set initial status to indicate mapping is starting
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'mapping_in_progress',
        metadata: {
          ...(analysis.metadata as any || {}),
          mapping: {
            status: 'in_progress',
            started_at: new Date().toISOString(),
          },
        },
      })
      .eq('id', analysisId);

    // Trigger mapping phase ASYNCHRONOUSLY (non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze/map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Call': 'true',
      },
      body: JSON.stringify({ analysisId }),
    }).catch((err) => {
      console.error('[Start] Erreur lors du déclenchement du mapping:', err);
      // Update status to failed
      supabaseAdmin
        .from('analyses')
        .update({
          status: 'failed',
          metadata: {
            ...(analysis.metadata as any || {}),
            mapping: {
              status: 'failed',
              error: err instanceof Error ? err.message : 'Erreur inconnue',
            },
          },
        })
        .eq('id', analysisId);
    });

    return NextResponse.json({
      success: true,
      message: 'Traitement démarré. Le mapping est en cours...',
      requiresMappingConfirmation: true,
    });
  } catch (error) {
    console.error('Start analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
