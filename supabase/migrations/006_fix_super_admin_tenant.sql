-- ============================================
-- FIX SUPER_ADMIN TENANT ISOLATION
-- Permet aux SUPER_ADMIN de ne pas avoir de tenant_id
-- ============================================

-- Step 1: Make tenant_id nullable for SUPER_ADMIN
ALTER TABLE profiles 
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Step 2: Update helper function to handle SUPER_ADMIN (no tenant_id)
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
    SELECT 
      CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN' 
        THEN NULL
        ELSE (SELECT tenant_id FROM profiles WHERE id = auth.uid())
      END;
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 3: Update existing SUPER_ADMIN to have tenant_id = NULL
UPDATE profiles 
SET tenant_id = NULL 
WHERE role = 'SUPER_ADMIN';

-- Step 4: Update RLS policies for profiles to handle NULL tenant_id
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
CREATE POLICY "Users can view profiles in their tenant"
    ON profiles FOR SELECT
    USING (
      -- SUPER_ADMIN can see all profiles
      is_super_admin() OR
      -- Users can see profiles in their tenant
      (tenant_id IS NOT NULL AND tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (
      -- SUPER_ADMIN can update any profile
      is_super_admin() OR
      -- Users can update their own profile in their tenant
      (id = auth.uid() AND tenant_id IS NOT NULL AND tenant_id = get_user_tenant_id())
    );

-- Step 5: Add constraint to ensure non-SUPER_ADMIN users have tenant_id
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_tenant_required 
  CHECK (
    role = 'SUPER_ADMIN' OR tenant_id IS NOT NULL
  );

-- Step 6: Update other policies to handle SUPER_ADMIN properly
-- (Analyses, stock_entries, recommendations already use get_user_tenant_id() which returns NULL for SUPER_ADMIN)
-- But we need to allow SUPER_ADMIN to see all data

DROP POLICY IF EXISTS "Users can view analyses in their tenant" ON analyses;
CREATE POLICY "Users can view analyses in their tenant"
    ON analyses FOR SELECT
    USING (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can create analyses in their tenant" ON analyses;
CREATE POLICY "Users can create analyses in their tenant"
    ON analyses FOR INSERT
    WITH CHECK (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can update analyses in their tenant" ON analyses;
CREATE POLICY "Users can update analyses in their tenant"
    ON analyses FOR UPDATE
    USING (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can view stock entries in their tenant" ON stock_entries;
CREATE POLICY "Users can view stock entries in their tenant"
    ON stock_entries FOR SELECT
    USING (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can create stock entries in their tenant" ON stock_entries;
CREATE POLICY "Users can create stock entries in their tenant"
    ON stock_entries FOR INSERT
    WITH CHECK (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can update stock entries in their tenant" ON stock_entries;
CREATE POLICY "Users can update stock entries in their tenant"
    ON stock_entries FOR UPDATE
    USING (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can view recommendations in their tenant" ON recommendations;
CREATE POLICY "Users can view recommendations in their tenant"
    ON recommendations FOR SELECT
    USING (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can create recommendations in their tenant" ON recommendations;
CREATE POLICY "Users can create recommendations in their tenant"
    ON recommendations FOR INSERT
    WITH CHECK (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );

DROP POLICY IF EXISTS "Users can update recommendations in their tenant" ON recommendations;
CREATE POLICY "Users can update recommendations in their tenant"
    ON recommendations FOR UPDATE
    USING (
      is_super_admin() OR
      tenant_id = get_user_tenant_id()
    );
