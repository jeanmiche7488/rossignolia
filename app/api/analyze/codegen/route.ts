import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { generateAnalysisPython } from '@/lib/ai/gemini';

export async function POST(request: Request) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await request.json();
    const { analysisId, promptCodegen } = body as { analysisId?: string; promptCodegen?: string };
    if (!analysisId) return NextResponse.json({ error: "ID d'analyse requis" }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('id,tenant_id,metadata,name')
      .eq('id', analysisId)
      .single();
    if (analysisError || !analysis) return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });

    // Dataset profile (léger): count + sample + champs
    const { count } = await supabaseAdmin
      .from('stock_entries')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', analysisId);

    const { data: sampleRows } = await supabaseAdmin
      .from('stock_entries')
      .select('sku,product_name,quantity,unit_cost,total_value,location,category,supplier,last_movement_date,days_since_last_movement,attributes,created_at')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: true })
      .limit(20);

    const fields = sampleRows && sampleRows.length > 0 ? Object.keys(sampleRows[0] as any) : [];
    const datasetProfile = {
      analysisId,
      analysisName: analysis.name,
      rowCount: count ?? null,
      fields,
      sample: sampleRows || [],
      contract: 'stdin JSONL rows => stdout JSON facts',
    };

    const meta = (analysis.metadata && typeof analysis.metadata === 'object' && !Array.isArray(analysis.metadata))
      ? (analysis.metadata as Record<string, unknown>)
      : {};
    const analysisMeta = (meta as any).analysis || {};

    const prompt = typeof promptCodegen === 'string' && promptCodegen.trim().length > 0
      ? promptCodegen
      : (analysisMeta.prompt_codegen_override as string) || '';

    const result = await generateAnalysisPython({
      datasetProfile,
      prompt,
      tenantId: analysis.tenant_id,
      useDbPrompt: true,
    });

    // Save generated python in metadata (non override)
    await supabaseAdmin
      .from('analyses')
      .update({
        metadata: {
          ...meta,
          analysis: {
            ...(analysisMeta || {}),
            prompt_codegen_override: prompt,
            python_generated: result.pythonCode,
            codegen_notes: result.notes,
            codegen_at: new Date().toISOString(),
          },
        },
        status: 'ready_for_analysis',
      })
      .eq('id', analysisId);

    return NextResponse.json({ success: true, pythonCode: result.pythonCode, notes: result.notes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

