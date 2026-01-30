import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/prompts/duplicate
 * Duplicate a global prompt to a specific tenant
 */
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { promptId, tenantId } = body;

    if (!promptId || !tenantId) {
      return NextResponse.json({ error: 'promptId et tenantId requis' }, { status: 400 });
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get the source prompt
    const { data: sourcePrompt, error: sourceError } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    if (sourceError || !sourcePrompt) {
      return NextResponse.json({ error: 'Prompt source non trouvé' }, { status: 404 });
    }

    // Check if a tenant-specific prompt already exists
    const { data: existingPrompt } = await supabaseAdmin
      .from('system_prompts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('module_code', sourcePrompt.module_code)
      .eq('prompt_type', sourcePrompt.prompt_type)
      .eq('is_active', true)
      .single();

    if (existingPrompt) {
      return NextResponse.json(
        { error: 'Un prompt personnalisé existe déjà pour ce tenant et ce type' },
        { status: 409 }
      );
    }

    // Create the tenant-specific prompt
    const { data: newPrompt, error: insertError } = await supabaseAdmin
      .from('system_prompts')
      .insert({
        tenant_id: tenantId,
        module_code: sourcePrompt.module_code,
        prompt_type: sourcePrompt.prompt_type,
        title: sourcePrompt.title,
        content: sourcePrompt.content,
        config: sourcePrompt.config,
        version: 1,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating tenant prompt:', insertError);
      return NextResponse.json({ error: 'Erreur lors de la création du prompt' }, { status: 500 });
    }

    return NextResponse.json({ success: true, prompt: newPrompt });
  } catch (error) {
    console.error('Error duplicating prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
