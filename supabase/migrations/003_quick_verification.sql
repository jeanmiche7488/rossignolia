-- ============================================
-- VERIFICATION RAPIDE - Migration 001
-- Vérification complète en une seule requête
-- ============================================

-- Résumé complet de la migration
SELECT 
    'Tables' as category,
    COUNT(*) as count,
    string_agg(table_name, ', ' ORDER BY table_name) as items
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'tenants', 'modules', 'tenant_modules', 'profiles', 
        'system_prompts', 'analyses', 'stock_entries', 'recommendations'
    )

UNION ALL

SELECT 
    'RLS Enabled' as category,
    COUNT(*) as count,
    string_agg(tablename, ', ' ORDER BY tablename) as items
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'tenants', 'modules', 'tenant_modules', 'profiles', 
        'system_prompts', 'analyses', 'stock_entries', 'recommendations'
    )
    AND rowsecurity = true

UNION ALL

SELECT 
    'Policies' as category,
    COUNT(*) as count,
    COUNT(*)::text || ' policies créées' as items
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Indexes' as category,
    COUNT(*) as count,
    string_agg(DISTINCT tablename, ', ' ORDER BY tablename) as items
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'tenants', 'modules', 'tenant_modules', 'profiles', 
        'system_prompts', 'analyses', 'stock_entries', 'recommendations'
    )

UNION ALL

SELECT 
    'Functions' as category,
    COUNT(*) as count,
    string_agg(routine_name, ', ' ORDER BY routine_name) as items
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'get_user_tenant_id', 'is_super_admin', 'update_updated_at_column'
    )

UNION ALL

SELECT 
    'Triggers' as category,
    COUNT(*) as count,
    string_agg(DISTINCT event_object_table, ', ' ORDER BY event_object_table) as items
FROM information_schema.triggers
WHERE trigger_schema = 'public';
