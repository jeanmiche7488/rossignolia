import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { prepareCleaningPlan } from '@/lib/ai/gemini';

/**
 * POST /api/analyze/clean/prepare
 * Generates cleaning plan (Python code + actions) without executing
 */
export async function POST(request: Request) {
  let storedAnalysisId: string | null = null;

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
    storedAnalysisId = analysisId;

    if (!analysisId) {
      return NextResponse.json({ error: "ID d'analyse requis" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get analysis with mapping
    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });
    }

    if (!analysis.mapped_columns) {
      return NextResponse.json({ error: 'Mapping non effectué' }, { status: 400 });
    }

    console.log('[Clean Prepare] Début préparation pour:', analysisId);

    // Get all files for this analysis
    const { data: analysisFiles, error: filesError } = await supabaseAdmin
      .from('analysis_files')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('uploaded_at', { ascending: true });

    if (filesError || !analysisFiles || analysisFiles.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier trouvé' }, { status: 404 });
    }

    // Aggregate all files into a single dataset (same as current clean route)
    const xlsx = await import('xlsx');
    const allRawData: Record<string, unknown>[] = [];

    for (const fileRecord of analysisFiles) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('analysis-files')
        .download(fileRecord.file_path);

      if (downloadError || !fileData) {
        console.warn(`Could not download file ${fileRecord.file_name}:`, downloadError);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = xlsx.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = xlsx.utils.sheet_to_json(firstSheet, { defval: null });
      allRawData.push(...(jsonData as Record<string, unknown>[]));
    }

    if (allRawData.length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à nettoyer' }, { status: 400 });
    }

    console.log('[Clean Prepare] Total lignes agrégées:', allRawData.length);

    // Call Gemini to prepare cleaning plan (new function)
    const cleaningPlan = await prepareCleaningPlan({
      data: allRawData,
      mappedColumns: analysis.mapped_columns as Record<string, string>,
      tenantId: analysis.tenant_id,
    });

    // Store the plan in metadata
    const metadata = (analysis.metadata as Record<string, unknown>) || {};
    const updatedMetadata = {
      ...metadata,
      cleaningPlan: {
        actions: cleaningPlan.actions,
        pythonCode: cleaningPlan.pythonCode,
        summary: cleaningPlan.summary,
        preparedAt: new Date().toISOString(),
      },
    };

    // Update analysis status and metadata
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'cleaning_prepared',
        metadata: updatedMetadata,
      })
      .eq('id', analysisId);

    console.log('[Clean Prepare] Plan généré avec', cleaningPlan.actions.length, 'actions');

    return NextResponse.json({
      success: true,
      plan: cleaningPlan,
    });
  } catch (error) {
    console.error('[Clean Prepare] Erreur:', error);

    // Update status to failed
    if (storedAnalysisId) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await supabaseAdmin
        .from('analyses')
        .update({ status: 'cleaning_failed' })
        .eq('id', storedAnalysisId);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
