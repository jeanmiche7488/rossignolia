import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { cleanData } from '@/lib/ai/gemini';

export async function POST(request: Request) {
  // Store analysisId early for error handling (body can only be read once)
  let storedAnalysisId: string | null = null;
  
  try {
    // Check if this is an internal server call (from /api/analyze/map)
    const isInternalCall = request.headers.get('X-Internal-Call') === 'true';
    
    let user;
    if (!isInternalCall) {
      // Normal call from client - check auth
      const supabase = await createServerComponentClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
      }
      user = authUser;
    }

    const body = await request.json();
    const { analysisId } = body;

    // Store for error handling
    storedAnalysisId = analysisId;

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

    // Mark cleaning in progress
    await supabaseAdmin
      .from('analyses')
      .update({ status: 'cleaning_in_progress' })
      .eq('id', analysisId);

    console.log('[Clean] Début du nettoyage pour l\'analyse:', analysisId);
    
    // Get all files for this analysis and aggregate them (same logic as mapping phase)
    const { data: analysisFiles, error: filesError } = await supabaseAdmin
      .from('analysis_files')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('uploaded_at', { ascending: true });

    if (filesError || !analysisFiles || analysisFiles.length === 0) {
      console.error('[Clean] Aucun fichier trouvé:', filesError);
      return NextResponse.json({ error: 'Aucun fichier trouvé pour cette analyse' }, { status: 404 });
    }
    
    console.log('[Clean] Fichiers trouvés:', analysisFiles.length);
    analysisFiles.forEach((file, index) => {
      console.log(`[Clean] Fichier ${index + 1}: ${file.file_name} (${file.row_count} lignes)`);
    });

    // Aggregate all files into a single dataset (same as mapping phase)
    const allRawData: Record<string, unknown>[] = [];

    for (const fileRecord of analysisFiles) {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('analysis-files')
        .download(fileRecord.file_path);

      if (downloadError || !fileData) {
        console.warn(`Could not download file ${fileRecord.file_name}:`, downloadError);
        continue;
      }

      // Parse file (CSV or Excel)
      const arrayBuffer = await fileData.arrayBuffer();
      let fileRawData: Record<string, unknown>[] = [];

      if (fileRecord.file_path.endsWith('.csv')) {
        // Parse CSV
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length === 0) {
          console.warn(`File ${fileRecord.file_name} is empty`);
          continue;
        }
        
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        fileRawData = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
      } else {
        // Parse Excel (XLS/XLSX) - requires xlsx package
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          fileRawData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, unknown>[];
        } catch (excelError) {
          console.warn(`Could not parse Excel file ${fileRecord.file_name}:`, excelError);
          continue;
        }
      }

      allRawData.push(...fileRawData);
    }

    if (allRawData.length === 0) {
      console.error('[Clean] Aucune donnée valide trouvée');
      return NextResponse.json({ error: 'Aucune donnée valide trouvée dans les fichiers' }, { status: 400 });
    }

    const rawData = allRawData;
    console.log('[Clean] Données agrégées:', rawData.length, 'lignes');
    console.log('[Clean] Colonnes mappées:', JSON.stringify(analysis.mapped_columns, null, 2));
    console.log('[Clean] Échantillon de données (3 premières lignes):', JSON.stringify(rawData.slice(0, 3), null, 2));

    // Call Gemini for cleaning
    console.log('[Clean] Appel à Gemini pour le nettoyage...');
    const cleaningResult = await cleanData({
      data: rawData,
      mappedColumns: analysis.mapped_columns as Record<string, string>,
      tenantId: analysis.tenant_id,
      useDbPrompt: true,
    });
    
    console.log('[Clean] Nettoyage terminé avec succès');
    console.log('[Clean] Nombre d\'entrées nettoyées:', cleaningResult.cleanedData.length);

    // Insert cleaned data into stock_entries
    console.log('[Clean] Préparation des entrées pour insertion...');
    const stockEntries = cleaningResult.cleanedData.map((entry, index) => {
      if (index < 3) {
        console.log(`[Clean] Exemple d'entrée ${index + 1}:`, JSON.stringify(entry, null, 2));
      }
      return {
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
      };
    });

    console.log('[Clean] Total d\'entrées à insérer:', stockEntries.length);

    // Insert in batches (Supabase has a limit)
    const batchSize = 1000;
    let totalInserted = 0;
    for (let i = 0; i < stockEntries.length; i += batchSize) {
      const batch = stockEntries.slice(i, i + batchSize);
      console.log(`[Clean] Insertion du batch ${Math.floor(i / batchSize) + 1} (${batch.length} entrées)...`);
      const { error: insertError } = await supabaseAdmin
        .from('stock_entries')
        .insert(batch);

      if (insertError) {
        console.error(`[Clean] Erreur lors de l'insertion du batch ${Math.floor(i / batchSize) + 1}:`, insertError);
        throw new Error(`Erreur lors de l'insertion des données: ${insertError.message}`);
      }
      totalInserted += batch.length;
      console.log(`[Clean] Batch inséré avec succès. Total: ${totalInserted}/${stockEntries.length}`);
    }
    
    console.log('[Clean] Toutes les entrées ont été insérées avec succès');

    // Update analysis with cleaning report
    // Safely handle metadata - it might be null or undefined
    const currentMetadata = (analysis.metadata && typeof analysis.metadata === 'object' && !Array.isArray(analysis.metadata))
      ? analysis.metadata
      : {};
    
    await supabaseAdmin
      .from('analyses')
      .update({
        metadata: {
          ...currentMetadata,
          cleaning: {
            report: cleaningResult.cleaningReport,
            pythonCode: cleaningResult.pythonCode,
          },
        },
        status: 'ready_for_analysis',
      })
      .eq('id', analysisId);

    return NextResponse.json({
      success: true,
      cleaning: cleaningResult.cleaningReport,
      entriesInserted: stockEntries.length,
    });
  } catch (error) {
    console.error('[Clean] ERREUR dans la phase de nettoyage');
    console.error('[Clean] Type d\'erreur:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Clean] Message d\'erreur:', error instanceof Error ? error.message : String(error));
    console.error('[Clean] Stack trace:', error instanceof Error ? error.stack : 'N/A');
    
    // Si c'est une erreur de parsing JSON, afficher plus de détails
    if (error instanceof Error && error.message.includes('parse')) {
      console.error('[Clean] C\'est une erreur de parsing JSON');
    }
    
    // Update analysis status to failed
    try {
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
      
      // Use stored analysisId (body already read)
      if (storedAnalysisId) {
        await supabaseAdmin
          .from('analyses')
          .update({ status: 'failed' })
          .eq('id', storedAnalysisId);
      }
    } catch (updateError) {
      console.error('Failed to update analysis status:', updateError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
