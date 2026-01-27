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
    const { userId, permissions } = body;

    if (!userId || !permissions) {
      return NextResponse.json(
        { error: 'User ID et permissions sont requis' },
        { status: 400 }
      );
    }

    // Validate permissions structure
    if (typeof permissions !== 'object' || !permissions.modules) {
      return NextResponse.json(
        { error: 'Format de permissions invalide. Attendu: { "modules": { "module_code": { "read": boolean, "write": boolean } } }' },
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

    // Update user permissions
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ permissions })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedProfile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
