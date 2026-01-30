import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

/**
 * DELETE /api/admin/prompts/[id]
 * Delete a tenant-specific prompt (revert to global)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: promptId } = await params;

    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Check if user is SUPER_ADMIN
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get the prompt to verify it's tenant-specific
    const { data: prompt, error: fetchError } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    if (fetchError || !prompt) {
      return NextResponse.json({ error: 'Prompt non trouvé' }, { status: 404 });
    }

    if (!prompt.tenant_id) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un prompt global' },
        { status: 400 }
      );
    }

    // Delete the tenant-specific prompt
    const { error: deleteError } = await supabaseAdmin
      .from('system_prompts')
      .delete()
      .eq('id', promptId);

    if (deleteError) {
      console.error('Error deleting tenant prompt:', deleteError);
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
