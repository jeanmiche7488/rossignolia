-- ============================================
-- ADD SUPPORT FOR MULTIPLE FILES PER ANALYSIS
-- ============================================

-- Table to store individual files for each analysis
CREATE TABLE analysis_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'csv', 'xlsx', etc.
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    file_size BIGINT, -- Size in bytes
    source_type TEXT, -- 'stock', 'movements', 'suppliers', 'sales', etc.
    description TEXT, -- User description of what this file contains
    original_columns JSONB, -- Columns found in this file
    row_count INTEGER, -- Number of rows in the file
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analysis_files_analysis_id ON analysis_files(analysis_id);
CREATE INDEX idx_analysis_files_tenant_id ON analysis_files(tenant_id);

-- RLS Policies
ALTER TABLE analysis_files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files for analyses in their tenant
CREATE POLICY "Users can view analysis files in their tenant"
ON analysis_files FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
);

-- Policy: Users can insert files for analyses in their tenant
CREATE POLICY "Users can insert analysis files in their tenant"
ON analysis_files FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
);

-- Policy: SUPER_ADMIN can view all files
CREATE POLICY "Super admins can view all analysis files"
ON analysis_files FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);
