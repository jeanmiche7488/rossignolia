import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { cleanData } from '@/lib/ai/gemini';

/**
 * POST /api/analyze/clean/execute
 * Executes the validated cleaning plan
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
    const { analysisId, actions, pythonCode } = body;
    storedAnalysisId = analysisId;

    if (!analysisId) {
      return NextResponse.json({ error: "ID d'analyse requis" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
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

    if (!analysis.mapped_columns) {
      return NextResponse.json({ error: 'Mapping non effectué' }, { status: 400 });
    }

    // Mark cleaning in progress
    await supabaseAdmin
      .from('analyses')
      .update({ status: 'cleaning_in_progress' })
      .eq('id', analysisId);

    console.log('[Clean Execute] Début exécution pour:', analysisId);

    // Get all files for this analysis
    const { data: analysisFiles, error: filesError } = await supabaseAdmin
      .from('analysis_files')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('uploaded_at', { ascending: true });

    if (filesError || !analysisFiles || analysisFiles.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier trouvé' }, { status: 404 });
    }

    // Aggregate all files into a single dataset
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

    console.log('[Clean Execute] Total lignes:', allRawData.length);

    // Get enabled actions from request or use stored plan
    const metadata = (analysis.metadata as Record<string, unknown>) || {};
    const storedPlan = (metadata as any)?.cleaningPlan;
    
    // Use provided actions or fall back to stored plan
    const enabledActions = actions || storedPlan?.actions?.filter((a: any) => a.enabled) || [];
    const finalPythonCode = pythonCode || storedPlan?.pythonCode || '';

    // Call the existing cleanData function to actually clean the data
    // Pass additional context about which actions are enabled
    const cleaningResult = await cleanData({
      data: allRawData,
      mappedColumns: analysis.mapped_columns as Record<string, string>,
      tenantId: analysis.tenant_id,
      issues: enabledActions.map((a: any) => `[${a.enabled ? 'ON' : 'OFF'}] ${a.description}`),
    });

    // Insert cleaned data into stock_entries
    console.log('[Clean Execute] Préparation des entrées pour insertion...');
    const stockEntries = cleaningResult.cleanedData.map((entry: any) => ({
      tenant_id: analysis.tenant_id,
      analysis_id: analysisId,
      sku: entry.sku || null,
      product_name: entry.product_name || null,
      quantity: entry.quantity ? Number(entry.quantity) : null,
      unit_cost: entry.unit_cost ? Number(entry.unit_cost) : null,
      local_currency: entry.local_currency ?? null,
      unit_cost_eur: entry.unit_cost_eur != null ? Number(entry.unit_cost_eur) : null,
      total_value: entry.total_value ? Number(entry.total_value) : null,
      location: entry.location || null,
      category: entry.category || null,
      supplier: entry.supplier || null,
      last_movement_date: entry.last_movement_date || null,
      days_since_last_movement: entry.days_since_last_movement ? Number(entry.days_since_last_movement) : null,
      attributes: entry.attributes || {},
    }));

    console.log('[Clean Execute] Total entrées à insérer:', stockEntries.length);

    // Insert in batches
    const batchSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < stockEntries.length; i += batchSize) {
      const batch = stockEntries.slice(i, i + batchSize);
      const { error: insertError } = await supabaseAdmin.from('stock_entries').insert(batch);

      if (insertError) {
        console.error('[Clean Execute] Erreur insertion batch:', insertError);
        throw new Error(`Erreur lors de l'insertion: ${insertError.message}`);
      }

      totalInserted += batch.length;
      console.log(`[Clean Execute] Batch inséré: ${totalInserted}/${stockEntries.length}`);
    }

    // Update analysis metadata with cleaning report
    const updatedMetadata = {
      ...metadata,
      cleaning: {
        report: cleaningResult.cleaningReport,
        pythonCode: finalPythonCode || cleaningResult.pythonCode,
        executedActions: enabledActions,
        executedAt: new Date().toISOString(),
      },
    };

    // Update status to ready for analysis
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'ready_for_analysis',
        metadata: updatedMetadata,
      })
      .eq('id', analysisId);

    console.log('[Clean Execute] Cleaning terminé avec succès');

    return NextResponse.json({
      success: true,
      entriesInserted: totalInserted,
      report: cleaningResult.cleaningReport,
    });
  } catch (error) {
    console.error('[Clean Execute] Erreur:', error);

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
