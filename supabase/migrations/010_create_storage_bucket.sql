-- ============================================
-- CREATE STORAGE BUCKET FOR ANALYSIS FILES
-- ============================================
-- This migration creates the storage bucket for analysis files
-- Note: Storage buckets are created via Supabase Dashboard or API
-- This SQL is for documentation purposes

-- To create the bucket manually:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create a new bucket named 'analysis-files'
-- 3. Set it as private (not public)
-- 4. Set file size limit to 10MB
-- 5. Set allowed MIME types: text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

-- Storage policies (RLS for storage)
-- Allow authenticated users to upload files to their tenant's folder
CREATE POLICY "Users can upload files to their tenant folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'analysis-files' AND
  (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
);

-- Allow users to read files from their tenant's folder
CREATE POLICY "Users can read files from their tenant folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'analysis-files' AND
  (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
);

-- Allow users to delete files from their tenant's folder
CREATE POLICY "Users can delete files from their tenant folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'analysis-files' AND
  (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
);

-- SUPER_ADMIN can access all files
CREATE POLICY "Super admins can access all files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'analysis-files' AND
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
