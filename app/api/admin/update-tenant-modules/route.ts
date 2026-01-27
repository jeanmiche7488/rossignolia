import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: Request) {
  try {
    // Verify user is SUPER_ADMIN
    const supabase = await createServerComponentClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantId, moduleCodes } = body;

    if (!tenantId || !Array.isArray(moduleCodes)) {
      return NextResponse.json(
        { error: 'Tenant ID et liste de modules sont requis' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    // IMPORTANT: Next.js loads env vars in this order:
    // 1. process.env (system/env vars)
    // 2. .env.local
    // 3. .env
    
    // Try to read directly from .env.local as fallback
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Debug: Check all possible sources
    console.log('Environment check:', {
      fromProcessEnv: serviceRoleKey,
      processEnvLength: serviceRoleKey?.length,
      isPlaceholder: serviceRoleKey?.includes('YOUR_') || serviceRoleKey?.includes('your_'),
    });

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
        keyPrefix: serviceRoleKey ? serviceRoleKey.substring(0, 20) : 'none',
      });
      return NextResponse.json(
        { error: 'Configuration manquante : SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL' },
        { status: 500 }
      );
    }

    // Debug: Log key info (first 30 chars only for security)
    console.log('Service role key info:', {
      keyLength: serviceRoleKey.length,
      keyPrefix: serviceRoleKey.substring(0, 30),
      keySuffix: serviceRoleKey.substring(serviceRoleKey.length - 10),
      url: supabaseUrl,
      envVarExists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      envVarLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
    });
    
    // Check if key looks like a placeholder
    if (serviceRoleKey.includes('YOUR_') || serviceRoleKey.includes('your_') || serviceRoleKey.length < 100) {
      console.error('⚠️ WARNING: Service role key appears to be a placeholder or invalid!');
      console.error('Expected: JWT token starting with "eyJ..." and length > 200');
      console.error('Got:', {
        length: serviceRoleKey.length,
        firstChars: serviceRoleKey.substring(0, 50),
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey.trim(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get all modules
    const { data: allModules, error: modulesError } = await supabaseAdmin
      .from('modules')
      .select('id, code');

    if (modulesError || !allModules) {
      console.error('Error fetching modules:', modulesError);
      return NextResponse.json(
        { error: `Erreur lors de la récupération des modules: ${modulesError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('All modules:', allModules);
    console.log('Module codes to enable:', moduleCodes);
    console.log('Tenant ID:', tenantId);

    // Get current tenant modules (with enabled status)
    const { data: currentTenantModules, error: currentModulesError } = await supabaseAdmin
      .from('tenant_modules')
      .select('module_id, enabled')
      .eq('tenant_id', tenantId);

    if (currentModulesError) {
      console.error('Error fetching current tenant modules:', currentModulesError);
    }

    console.log('Current tenant modules:', currentTenantModules);

    // Create a map of module code to module id
    const moduleCodeToId = new Map(
      allModules.map((m) => [m.code, m.id])
    );

    // Prepare all modules for upsert (simplified approach)
    const modulesToUpsert = moduleCodes
      .map((code: string) => {
        const moduleId = moduleCodeToId.get(code);
        if (!moduleId) {
          console.warn(`Module code "${code}" not found in modules table`);
          return null;
        }
        return {
          tenant_id: tenantId,
          module_id: moduleId,
          enabled: true,
        };
      })
      .filter((m): m is { tenant_id: string; module_id: string; enabled: boolean } => m !== null);

    console.log('Modules to upsert:', modulesToUpsert);

    // Upsert all enabled modules at once
    // Note: For composite unique constraints, we need to handle each module individually
    if (modulesToUpsert.length > 0) {
      for (const module of modulesToUpsert) {
        // First, try to check if it exists
        const { data: existing } = await supabaseAdmin
          .from('tenant_modules')
          .select('id')
          .eq('tenant_id', module.tenant_id)
          .eq('module_id', module.module_id)
          .single();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabaseAdmin
            .from('tenant_modules')
            .update({ enabled: true })
            .eq('tenant_id', module.tenant_id)
            .eq('module_id', module.module_id);

          if (updateError) {
            console.error(`Error updating module ${module.module_id}:`, updateError);
            return NextResponse.json(
              { error: `Erreur lors de la mise à jour du module: ${updateError.message}` },
              { status: 500 }
            );
          }
        } else {
          // Insert new
          const { error: insertError } = await supabaseAdmin
            .from('tenant_modules')
            .insert({
              tenant_id: module.tenant_id,
              module_id: module.module_id,
              enabled: true,
            });

          if (insertError) {
            console.error(`Error inserting module ${module.module_id}:`, insertError);
            return NextResponse.json(
              { error: `Erreur lors de l'insertion du module: ${insertError.message}` },
              { status: 500 }
            );
          }
        }
      }

      console.log(`Successfully processed ${modulesToUpsert.length} modules`);
    }

    // Disable modules that are not in the enabled list
    const enabledModuleIds = new Set(
      moduleCodes
        .map((code: string) => moduleCodeToId.get(code))
        .filter((id): id is string => id !== undefined)
    );

    const allModuleIds = new Set(allModules.map((m) => m.id));
    const modulesToDisable = Array.from(allModuleIds).filter(
      (moduleId) => !enabledModuleIds.has(moduleId)
    );

    if (modulesToDisable.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('tenant_modules')
        .update({ enabled: false })
        .eq('tenant_id', tenantId)
        .in('module_id', modulesToDisable);

      if (updateError) {
        console.error('Error disabling modules:', updateError);
        return NextResponse.json(
          { error: `Erreur lors de la désactivation des modules: ${updateError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
