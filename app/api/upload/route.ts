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

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.tenant_id) {
      return NextResponse.json({ error: 'Tenant non trouvé' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const analysisId = formData.get('analysisId') as string;
    const sourceType = (formData.get('sourceType') as string) || 'stock';
    const description = (formData.get('description') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!analysisId) {
      return NextResponse.json({ error: 'ID d\'analyse requis' }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExtension)
    ) {
      return NextResponse.json(
        { error: 'Type de fichier non supporté. Utilisez CSV, XLS ou XLSX' },
        { status: 400 }
      );
    }

    // Use service role client for storage operations
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

    // Create storage bucket if it doesn't exist (one-time setup)
    // Note: This should be done via Supabase dashboard, but we check here
    const bucketName = 'analysis-files';
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucketName);

    if (!bucketExists) {
      // Try to create bucket (may fail if no permissions, but that's ok)
      await supabaseAdmin.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });
    }

    // Upload file to storage
    // Path: tenant_id/analysis_id/filename
    const filePath = `${profile.tenant_id}/${analysisId}/${file.name}`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Erreur lors de l'upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL (or signed URL for private buckets)
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    // Parse file to get column count (for metadata)
    let rowCount = 0;
    let originalColumns: string[] = [];
    
    try {
      // Quick parse to get columns (we'll do full parse in mapping phase)
      if (filePath.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length > 0) {
          originalColumns = lines[0].split(',').map((col) => col.trim().replace(/^"|"$/g, ''));
          rowCount = lines.length - 1; // Exclude header
        }
      }
    } catch (parseError) {
      console.warn('Could not parse file for metadata:', parseError);
    }

    // Insert file record in analysis_files table
    const { data: fileRecord, error: fileRecordError } = await supabaseAdmin
      .from('analysis_files')
      .insert({
        analysis_id: analysisId,
        tenant_id: profile.tenant_id,
        file_name: file.name,
        file_type: fileExtension.replace('.', ''),
        file_path: filePath,
        file_size: file.size,
        source_type: sourceType,
        description: description || null,
        original_columns: originalColumns.length > 0 ? originalColumns : null,
        row_count: rowCount,
      })
      .select()
      .single();

    if (fileRecordError) {
      console.error('File record error:', fileRecordError);
      // Don't fail the upload if record creation fails, but log it
    }

    return NextResponse.json({
      success: true,
      filePath: uploadData.path,
      analysisId,
      fileId: fileRecord?.id,
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
