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
    const { userId, email, fullName, tenantId, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID est requis' },
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

    // Update profile
    const updateData: { email?: string; full_name?: string; tenant_id?: string; role?: string } = {};
    if (email !== undefined) updateData.email = email.trim();
    if (fullName !== undefined) updateData.full_name = fullName.trim() || null;
    if (tenantId !== undefined) updateData.tenant_id = tenantId || null;
    if (role !== undefined) updateData.role = role;

    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    // Update auth user email if changed
    if (email && email !== updatedProfile.email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: email.trim(),
        email_confirm: true,
      });

      if (authError) {
        return NextResponse.json(
          { error: `Erreur lors de la mise à jour de l'email: ${authError.message}` },
          { status: 400 }
        );
      }
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
