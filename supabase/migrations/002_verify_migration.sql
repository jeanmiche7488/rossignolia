-- ============================================
-- VERIFICATION SCRIPT - Migration 001
-- Run this to verify that all tables, RLS, and policies are correctly set up
-- ============================================

-- 1. Check that all tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'tenants',
        'modules',
        'tenant_modules',
        'profiles',
        'system_prompts',
        'analyses',
        'stock_entries',
        'recommendations'
    )
ORDER BY table_name;

-- 2. Check that RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'tenants',
        'modules',
        'tenant_modules',
        'profiles',
        'system_prompts',
        'analyses',
        'stock_entries',
        'recommendations'
    )
ORDER BY tablename;

-- 3. Check that all policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Check that indexes exist
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'tenants',
        'modules',
        'tenant_modules',
        'profiles',
        'system_prompts',
        'analyses',
        'stock_entries',
        'recommendations'
    )
ORDER BY tablename, indexname;

-- 5. Check that helper functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'get_user_tenant_id',
        'is_super_admin',
        'update_updated_at_column'
    )
ORDER BY routine_name;

-- 6. Check that triggers exist
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
