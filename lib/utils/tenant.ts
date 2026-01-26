/**
 * Tenant utility functions
 * Ensures tenant isolation across all operations
 */

import { createBrowserClient } from '@/lib/db/supabase-client';

/**
 * Get the current user's tenant ID
 * @returns Promise<string | null> - The tenant ID or null if SUPER_ADMIN or not found
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const supabase = createBrowserClient();
  
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // SUPER_ADMIN doesn't have a tenant_id
  if (profile.role === 'SUPER_ADMIN') {
    return null;
  }

  return profile.tenant_id;
}

/**
 * Verify that a tenant ID matches the current user's tenant
 * Throws an error if the tenant IDs don't match
 */
export async function verifyTenantAccess(tenantId: string): Promise<void> {
  const currentTenantId = await getCurrentTenantId();

  if (!currentTenantId) {
    throw new Error('User not authenticated or no tenant found');
  }

  if (currentTenantId !== tenantId) {
    throw new Error('Access denied: Tenant ID mismatch');
  }
}

/**
 * Check if the current user is a SUPER_ADMIN
 * @returns Promise<boolean>
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = createBrowserClient();
  
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return false;
  }

  return profile.role === 'SUPER_ADMIN';
}
