import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: Request) {
  try {
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
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { promptId, title, content, config, is_active } = body;

    if (!promptId) {
      return NextResponse.json({ error: 'ID du prompt requis' }, { status: 400 });
    }

    // Use service role client
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

    // Get current prompt to get version
    const { data: currentPrompt } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    if (!currentPrompt) {
      return NextResponse.json({ error: 'Prompt non trouvé' }, { status: 404 });
    }

    // Update prompt (create new version if content changed significantly)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (config !== undefined) updateData.config = config;
    if (is_active !== undefined) updateData.is_active = is_active;

    // If content changed, increment version
    if (content && content !== currentPrompt.content) {
      updateData.version = (currentPrompt.version || 1) + 1;
    }

    const { data: updatedPrompt, error: updateError } = await supabaseAdmin
      .from('system_prompts')
      .update(updateData)
      .eq('id', promptId)
      .select()
      .single();

    if (updateError) {
      console.error('Update prompt error:', updateError);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }

    return NextResponse.json({ success: true, prompt: updatedPrompt });
  } catch (error) {
    console.error('Update prompt error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
