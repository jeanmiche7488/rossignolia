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
    const { tenantId, name, slug } = body;

    if (!tenantId || (!name && !slug)) {
      return NextResponse.json(
        { error: 'Tenant ID et au moins un champ à modifier sont requis' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
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

    // Check if slug already exists (if slug is being updated)
    if (slug) {
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', slug.trim())
        .neq('id', tenantId)
        .single();

      if (existingTenant) {
        return NextResponse.json(
          { error: 'Ce slug est déjà utilisé' },
          { status: 400 }
        );
      }
    }

    // Update tenant
    const updateData: { name?: string; slug?: string } = {};
    if (name) updateData.name = name.trim();
    if (slug) updateData.slug = slug.trim();

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId)
      .select()
      .single();

    if (tenantError) {
      return NextResponse.json(
        { error: tenantError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tenant,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
