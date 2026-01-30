import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { mapColumns } from '@/lib/ai/gemini';

export async function POST(request: Request) {
  // Store analysisId early for error handling (body can only be read once)
  let storedAnalysisId: string | null = null;
  
  try {
    // Check if this is an internal server call (from /api/analyze/start)
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

    if (!analysisId) {
      return NextResponse.json({ error: 'ID d\'analyse requis' }, { status: 400 });
    }

    // Store analysisId for error handling (body can only be read once)
    storedAnalysisId = analysisId;

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

    console.log('[Map] Début du mapping pour l\'analyse:', analysisId);
    
    // Get all files for this analysis
    const { data: analysisFiles, error: filesError } = await supabaseAdmin
      .from('analysis_files')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('uploaded_at', { ascending: true });

    if (filesError || !analysisFiles || analysisFiles.length === 0) {
      console.error('[Map] Aucun fichier trouvé:', filesError);
      return NextResponse.json({ error: 'Aucun fichier trouvé pour cette analyse' }, { status: 404 });
    }
    
    console.log('[Map] Fichiers trouvés:', analysisFiles.length);
    analysisFiles.forEach((file, index) => {
      console.log(`[Map] Fichier ${index + 1}: ${file.file_name} (${file.row_count} lignes)`);
    });

    // Aggregate all files into a single dataset
    const allRawData: Record<string, unknown>[] = [];
    const allColumns = new Set<string>();
    const fileMetadata: Array<{ file_name: string; source_type: string; row_count: number }> = [];

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
        headers.forEach((h) => allColumns.add(h));
        
        fileRawData = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          // Add metadata about source file
          row['_source_file'] = fileRecord.file_name;
          row['_source_type'] = fileRecord.source_type;
          return row;
        });
      } else {
        // Parse Excel (XLS/XLSX) - requires xlsx package
        try {
          // Try to import xlsx, but handle gracefully if not installed
          let XLSX;
          try {
            XLSX = await import('xlsx');
          } catch (importError) {
            return NextResponse.json(
              { 
                error: 'Le package xlsx n\'est pas installé. Installez-le avec: npm install xlsx',
                requiresXlsx: true,
              },
              { status: 500 }
            );
          }
          
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          fileRawData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, unknown>[];
          
          // Extract columns
          if (fileRawData.length > 0) {
            Object.keys(fileRawData[0]).forEach((col) => allColumns.add(col));
          }
          
          // Add metadata about source file
          fileRawData = fileRawData.map((row) => ({
            ...row,
            '_source_file': fileRecord.file_name,
            '_source_type': fileRecord.source_type,
          }));
        } catch (excelError) {
          console.warn(`Could not parse Excel file ${fileRecord.file_name}:`, excelError);
          return NextResponse.json(
            { 
              error: `Erreur lors du parsing du fichier Excel ${fileRecord.file_name}. Assurez-vous que le package xlsx est installé.`,
              requiresXlsx: true,
            },
            { status: 500 }
          );
        }
      }

      allRawData.push(...fileRawData);
      fileMetadata.push({
        file_name: fileRecord.file_name,
        source_type: fileRecord.source_type,
        row_count: fileRawData.length,
      });
    }

    if (allRawData.length === 0) {
      console.error('[Map] Aucune donnée valide trouvée');
      return NextResponse.json({ error: 'Aucune donnée valide trouvée dans les fichiers' }, { status: 400 });
    }

    console.log('[Map] Données agrégées:', allRawData.length, 'lignes');
    console.log('[Map] Colonnes uniques trouvées (avant filtrage):', allColumns.size);

    // Extract columns from aggregated data with file source information
    // IMPORTANT: Sort columns alphabetically for deterministic ordering
    const columns = Array.from(allColumns)
      .filter((col) => !col.startsWith('_')) // Exclude metadata columns
      .sort((a, b) => a.localeCompare(b)); // Alphabetical sort for determinism
    
    // Build column metadata: which file(s) contain each column
    // We need to track this from the actual parsed data, not just from fileRecord.original_columns
    // because Excel files might not have original_columns stored during upload
    const columnSources: Record<string, string[]> = {};
    
    // Re-parse files to get accurate column sources
    for (const fileRecord of analysisFiles) {
      try {
        const { data: fileData } = await supabaseAdmin.storage
          .from('analysis-files')
          .download(fileRecord.file_path);

        if (!fileData) continue;

        const arrayBuffer = await fileData.arrayBuffer();
        let fileColumns: string[] = [];

        if (fileRecord.file_path.endsWith('.csv')) {
          const text = new TextDecoder('utf-8').decode(arrayBuffer);
          const lines = text.split('\n').filter((line) => line.trim());
          if (lines.length > 0) {
            fileColumns = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
          }
        } else {
          // Excel - parse to get columns
          try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const firstRow = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 })[0] as any[];
            if (firstRow) {
              fileColumns = firstRow.filter((col) => col && typeof col === 'string').map((col) => String(col).trim());
            }
          } catch (excelError) {
            // Fallback to original_columns if available
            fileColumns = (fileRecord.original_columns as string[]) || [];
          }
        }

        // Map each column to its source file
        fileColumns.forEach((col) => {
          if (col && !col.startsWith('_')) {
            if (!columnSources[col]) {
              columnSources[col] = [];
            }
            if (!columnSources[col].includes(fileRecord.file_name)) {
              columnSources[col].push(fileRecord.file_name);
            }
          }
        });
      } catch (error) {
        console.warn(`[Map] Could not determine columns for ${fileRecord.file_name}:`, error);
        // Fallback to original_columns if available
        const fileColumns = (fileRecord.original_columns as string[]) || [];
        fileColumns.forEach((col) => {
          if (col && !col.startsWith('_')) {
            if (!columnSources[col]) {
              columnSources[col] = [];
            }
            if (!columnSources[col].includes(fileRecord.file_name)) {
              columnSources[col].push(fileRecord.file_name);
            }
          }
        });
      }
    }
    
    console.log('[Map] Colonnes après filtrage (excluant métadonnées):', columns.length);
    console.log('[Map] Sources des colonnes:', JSON.stringify(columnSources, null, 2));
    
    // Create deterministic sample data: take 2 rows from each file (sorted by file name)
    const sortedFileMetadata = [...fileMetadata].sort((a, b) => a.file_name.localeCompare(b.file_name));
    const sampleData: Record<string, unknown>[] = [];
    
    for (const fileMeta of sortedFileMetadata) {
      const fileRows = allRawData.filter((row) => row['_source_file'] === fileMeta.file_name);
      const fileSamples = fileRows.slice(0, 2).map((row) => {
        const sample: Record<string, unknown> = {};
        columns.forEach((col) => {
          sample[col] = row[col];
        });
        sample['_source_file'] = row['_source_file']; // Keep source for context
        return sample;
      });
      sampleData.push(...fileSamples);
    }
    
    console.log('[Map] Échantillon de données préparé:', sampleData.length, 'lignes (déterministe par fichier)');

    console.log('[Map] Colonnes uniques trouvées:', columns.length);
    console.log('[Map] Échantillon de données (3 premières lignes):', JSON.stringify(sampleData.slice(0, 3), null, 2));
    console.log('[Map] Appel à Gemini pour le mapping...');
    
    // Build detailed context about which columns come from which files
    // Sort column sources for deterministic output
    const sortedColumnSources = Object.entries(columnSources)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([col, sources]) => `  - "${col}" → [${sources.sort().join(', ')}]`)
      .join('\n');
    
    // Call Gemini for mapping with detailed context about column sources
    const mappingResult = await mapColumns({
      columns,
      sampleData,
      context: `Analyse de stock pour le tenant ${analysis.tenant_id}.

FICHIERS SOURCES (${analysisFiles.length}):
${sortedFileMetadata.map(f => `- ${f.file_name} (${f.source_type}, ${f.row_count} lignes)`).join('\n')}

COLONNES ET LEURS SOURCES:
${sortedColumnSources}

IMPORTANT: 
- Chaque colonne peut exister dans UN ou PLUSIEURS fichiers.
- Tu dois mapper TOUTES les colonnes pertinentes, même si elles n'apparaissent que dans un seul fichier.
- Si deux fichiers ont des colonnes similaires (ex: "SKU" et "Product Code"), mappe les deux vers le même champ cible si elles représentent la même donnée.`,
    }, {
      tenantId: analysis.tenant_id,
      useDbPrompt: true,
    });
    
    console.log('[Map] Mapping reçu de Gemini');

    // Determine if user confirmation is needed based on confidence threshold
    const CONFIDENCE_THRESHOLD = 0.8; // If confidence < 0.8, require user confirmation
    const requiresConfirmation = mappingResult.confidence < CONFIDENCE_THRESHOLD;

    console.log('[Map] Mapping terminé');
    console.log('[Map] Confiance:', mappingResult.confidence);
    console.log('[Map] Nécessite confirmation utilisateur:', requiresConfirmation);
    console.log('[Map] Mapping proposé:', JSON.stringify(mappingResult.mappedColumns, null, 2));

    // IMPORTANT: L'utilisateur doit TOUJOURS confirmer le mapping, même si la confiance est élevée
    // Le cleaning ne se lancera qu'après confirmation sur la page /stock/[id]/mapping
    await supabaseAdmin
      .from('analyses')
      .update({
        original_columns: columns,
        mapped_columns: mappingResult.mappedColumns, // Proposed mapping - user will confirm
        status: 'mapping_pending', // TOUJOURS attendre la confirmation utilisateur
        metadata: {
          ...(analysis.metadata as any || {}),
          mapping: {
            status: 'completed',
            completed_at: new Date().toISOString(),
            confidence: mappingResult.confidence,
            reasoning: mappingResult.reasoning,
            proposed_mapping: mappingResult.mappedColumns,
            confirmed_mapping: null, // Toujours null jusqu'à confirmation utilisateur
            requires_confirmation: true, // Toujours true
            column_sources: columnSources, // Store which file(s) contain each column
          },
          files: fileMetadata,
          total_rows: allRawData.length,
          aggregated_from: analysisFiles.length,
        },
      })
      .eq('id', analysisId);

    console.log('[Map] Analyse mise à jour avec status: mapping_pending');
    console.log('[Map] Attente de confirmation utilisateur sur /stock/[id]/mapping');

    console.log('[Map] Mapping terminé avec succès');
    console.log('[Map] Résumé:');
    console.log(`  - Fichiers traités: ${analysisFiles.length}`);
    console.log(`  - Lignes totales: ${allRawData.length}`);
    console.log(`  - Colonnes originales: ${columns.length}`);
    console.log(`  - Colonnes mappées: ${Object.keys(mappingResult.mappedColumns).length}`);
    console.log(`  - Confiance: ${mappingResult.confidence}`);
    
    return NextResponse.json({
      success: true,
      mapping: mappingResult,
      filesProcessed: analysisFiles.length,
      totalRows: allRawData.length,
      originalColumnsCount: columns.length,
      mappedColumnsCount: Object.keys(mappingResult.mappedColumns).length,
      requiresConfirmation: true, // Always require confirmation now
    });
  } catch (error) {
    console.error('Mapping error:', error);
    
    // Update analysis status to failed
    // Note: We need to read the body again, but it's already been read
    // So we'll try to get analysisId from the error context or skip update
    try {
      // Try to get analysisId from the request body if possible
      // Since body was already read, we'll need to parse it from the error or skip
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
      
      // Use stored analysisId
      const analysisIdToUpdate = storedAnalysisId;
      
      if (analysisIdToUpdate) {
        await supabaseAdmin
          .from('analyses')
          .update({ status: 'failed' })
          .eq('id', analysisIdToUpdate);
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
