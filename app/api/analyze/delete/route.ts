import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerComponentClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');

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

    // Use service role client for deletion
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

    // Get all files associated with this analysis
    const { data: analysisFiles } = await supabaseAdmin
      .from('analysis_files')
      .select('file_path')
      .eq('analysis_id', analysisId);

    // Delete files from storage
    if (analysisFiles && analysisFiles.length > 0) {
      const filePaths = analysisFiles.map((f) => f.file_path);
      for (const filePath of filePaths) {
        await supabaseAdmin.storage
          .from('analysis-files')
          .remove([filePath])
          .catch((err) => {
            console.warn(`Could not delete file ${filePath}:`, err);
          });
      }
    }

    // Delete related data (CASCADE should handle this, but we'll be explicit)
    // Delete recommendations
    await supabaseAdmin
      .from('recommendations')
      .delete()
      .eq('analysis_id', analysisId);

    // Delete stock entries
    await supabaseAdmin
      .from('stock_entries')
      .delete()
      .eq('analysis_id', analysisId);

    // Delete analysis files records
    await supabaseAdmin
      .from('analysis_files')
      .delete()
      .eq('analysis_id', analysisId);

    // Delete analysis
    const { error: deleteError } = await supabaseAdmin
      .from('analyses')
      .delete()
      .eq('id', analysisId);

    if (deleteError) {
      console.error('Delete analysis error:', deleteError);
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Analyse supprimée avec succès' });
  } catch (error) {
    console.error('Delete analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
