export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/db/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';

export async function POST(request: Request) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await request.json();
    const { analysisId } = body as { analysisId?: string };
    if (!analysisId) return NextResponse.json({ error: "ID d'analyse requis" }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: analysis, error: analysisError } = await supabaseAdmin
      .from('analyses')
      .select('id,tenant_id,metadata')
      .eq('id', analysisId)
      .single();
    if (analysisError || !analysis) return NextResponse.json({ error: 'Analyse non trouvée' }, { status: 404 });

    const meta = (analysis.metadata && typeof analysis.metadata === 'object' && !Array.isArray(analysis.metadata))
      ? (analysis.metadata as Record<string, unknown>)
      : {};
    const analysisMeta = (meta as any).analysis || {};

    const pythonCode: string =
      (analysisMeta.python_override as string) ||
      (analysisMeta.python_generated as string) ||
      '';

    if (!pythonCode.trim()) {
      return NextResponse.json({ error: "Aucun code Python à exécuter (générez-le d'abord)." }, { status: 400 });
    }

    // Mark analysis running
    await supabaseAdmin.from('analyses').update({ status: 'analysis_in_progress' }).eq('id', analysisId);

    // Spawn python (expects script reads JSONL from stdin and prints JSON facts to stdout)
    const child = spawn('python', ['-u', '-c', pythonCode], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    // Stream rows as JSONL (pagination)
    const batchSize = 2000;
    let lastId: string | null = null;
    let totalSent = 0;

    while (true) {
      let q = supabaseAdmin
        .from('stock_entries')
        .select('id,sku,product_name,quantity,unit_cost,total_value,location,category,supplier,last_movement_date,days_since_last_movement,attributes,created_at')
        .eq('analysis_id', analysisId)
        .order('id', { ascending: true })
        .limit(batchSize);
      if (lastId) q = q.gt('id', lastId);

      const { data: rows, error } = await q;
      if (error) throw new Error(`Erreur lecture stock_entries: ${error.message}`);
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        child.stdin.write(JSON.stringify(row) + '\n');
      }
      totalSent += rows.length;
      lastId = rows[rows.length - 1].id;
      if (rows.length < batchSize) break;
    }

    child.stdin.end();

    const exitCode: number = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { child.kill(); } catch {}
        reject(new Error('Timeout exécution Python'));
      }, 60_000);

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });

    if (exitCode !== 0) {
      await supabaseAdmin.from('analyses').update({ status: 'failed' }).eq('id', analysisId);
      return NextResponse.json(
        { error: `Exécution Python échouée (code ${exitCode})`, stderr: stderr.slice(0, 8000) },
        { status: 500 }
      );
    }

    let facts: any = null;
    try {
      facts = JSON.parse(stdout.trim());
    } catch (e) {
      await supabaseAdmin.from('analyses').update({ status: 'failed' }).eq('id', analysisId);
      return NextResponse.json(
        { error: `Sortie Python non-JSON: ${e instanceof Error ? e.message : String(e)}`, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 2000) },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('analyses')
      .update({
        metadata: {
          ...meta,
          analysis: {
            ...(analysisMeta || {}),
            facts_json: facts,
            executed_at: new Date().toISOString(),
            rows_streamed: totalSent,
            stderr: stderr ? stderr.slice(0, 8000) : '',
          },
        },
        status: 'ready_for_analysis',
      })
      .eq('id', analysisId);

    return NextResponse.json({ success: true, rowsStreamed: totalSent, facts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

