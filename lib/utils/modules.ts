import { createServerComponentClient } from '@/lib/db/supabase-server';

/**
 * Check if a module is enabled for a tenant
 */
export async function isModuleEnabledForTenant(
  tenantId: string,
  moduleCode: string
): Promise<boolean> {
  const supabase = await createServerComponentClient();

  // Get module ID from code
  const { data: module } = await supabase
    .from('modules')
    .select('id')
    .eq('code', moduleCode)
    .single();

  if (!module) {
    return false;
  }

  // Check if module is enabled for tenant
  const { data: tenantModule } = await supabase
    .from('tenant_modules')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_id', module.id)
    .eq('enabled', true)
    .single();

  return !!tenantModule;
}

/**
 * Get all enabled modules for a tenant
 */
export async function getEnabledModulesForTenant(
  tenantId: string
): Promise<string[]> {
  const supabase = await createServerComponentClient();

  const { data: tenantModules } = await supabase
    .from('tenant_modules')
    .select(`
      enabled,
      modules:module_id (
        code
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  if (!tenantModules) {
    return [];
  }

  return tenantModules
    .map((tm: any) => tm.modules?.code)
    .filter((code: string | undefined): code is string => !!code);
}

/**
 * Check if user has permission to access a module
 */
export async function hasModulePermission(
  userId: string,
  moduleCode: string,
  permission: 'read' | 'write'
): Promise<boolean> {
  const supabase = await createServerComponentClient();

  // Get user profile with permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, permissions')
    .eq('id', userId)
    .single();

  if (!profile || !profile.tenant_id) {
    return false;
  }

  // Check if module is enabled for tenant first
  const moduleEnabled = await isModuleEnabledForTenant(profile.tenant_id, moduleCode);
  if (!moduleEnabled) {
    return false;
  }

  // Check user permissions
  const permissions = (profile.permissions as any) || { modules: {} };
  const modulePerms = permissions.modules?.[moduleCode];

  // If no specific permissions set, default to read access
  if (!modulePerms) {
    return permission === 'read';
  }

  // Check permission
  if (permission === 'write') {
    return modulePerms.write === true && modulePerms.read === true;
  }

  return modulePerms.read === true;
}
