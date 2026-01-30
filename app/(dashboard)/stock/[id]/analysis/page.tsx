import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AnalysisDetailClient } from '../analysis-detail-client';
import { AnalysisPrepClient } from './prep-client';
import { getSystemPrompt } from '@/lib/ai/prompts';

interface AnalysisPrepPageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalysisPrepPage({ params }: AnalysisPrepPageProps) {
  const { id } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile?.tenant_id) redirect('/login');

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (error || !analysis) notFound();
  if (analysis.status === 'mapping_pending') redirect(`/stock/${id}/mapping`);

  const { data: stockEntries } = await supabase.from('stock_entries').select('id').eq('analysis_id', id).limit(1);
  const { data: recommendations } = await supabase.from('recommendations').select('id').eq('analysis_id', id).limit(1);

  // Prompt for codegen (tenant-specific then global)
  const promptCodegen = await getSystemPrompt(profile.tenant_id, 'stock', 'analysis_codegen');

  const metadata = (analysis.metadata as Record<string, unknown>) || {};
  const analysisMeta = (metadata as any)?.analysis || {};
  const promptCodegenOverride = analysisMeta.prompt_codegen_override as string | undefined;
  const pythonOverride = analysisMeta.python_override as string | undefined;
  const pythonGenerated = analysisMeta.python_generated as string | undefined;
  const factsJson = analysisMeta.facts_json as Record<string, unknown> | undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <AnalysisDetailClient
        analysisId={id}
        analysisStatus={analysis.status}
        hasStockEntries={(stockEntries?.length || 0) > 0}
        hasRecommendations={(recommendations?.length || 0) > 0}
      />

      <div className="container mx-auto p-8 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Préparer l'analyse</h1>
            <p className="text-muted-foreground mt-1">
              Générez le script d'analyse, vérifiez-le, puis lancez l'analyse pour obtenir des recommandations.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/stock/${id}/cleaning`}>
              <Button variant="outline">Retour au cleaning</Button>
            </Link>
            <Link href={`/stock/${id}`}>
              <Button variant="outline">Détail</Button>
            </Link>
          </div>
        </div>

        <AnalysisPrepClient
          analysisId={id}
          tenantId={profile.tenant_id}
          initialPromptCodegen={promptCodegenOverride ?? promptCodegen?.content ?? ''}
          initialPython={pythonOverride ?? pythonGenerated ?? ''}
          initialPythonGenerated={pythonGenerated ?? ''}
          initialFacts={factsJson ?? null}
        />
      </div>
    </div>
  );
}
