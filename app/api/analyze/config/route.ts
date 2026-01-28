import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisId, promptCodegenOverride, promptRecoOverride, pythonOverride } = body as {
      analysisId?: string;
      promptCodegenOverride?: string;
      promptRecoOverride?: string;
      pythonOverride?: string;
    };

    if (!analysisId) {
      return NextResponse.json({ error: "ID d'analyse requis" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: analysis, error } = await supabaseAdmin
      .from('analyses')
      .select('metadata,status')
      .eq('id', analysisId)
      .single();

    if (error || !analysis) {
      return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });
    }

    const current =
      analysis.metadata && typeof analysis.metadata === 'object' && !Array.isArray(analysis.metadata)
        ? (analysis.metadata as Record<string, unknown>)
        : {};

    await supabaseAdmin
      .from('analyses')
      .update({
        metadata: {
          ...current,
          analysis: {
            ...((current as any).analysis || {}),
            prompt_codegen_override:
              typeof promptCodegenOverride === 'string'
                ? promptCodegenOverride
                : ((current as any).analysis?.prompt_codegen_override || ''),
            prompt_reco_override:
              typeof promptRecoOverride === 'string'
                ? promptRecoOverride
                : ((current as any).analysis?.prompt_reco_override || ''),
            python_override: typeof pythonOverride === 'string' ? pythonOverride : ((current as any).analysis?.python_override || ''),
            updated_at: new Date().toISOString(),
          },
        },
        status: 'ready_for_analysis',
      })
      .eq('id', analysisId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

