import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AnalysisDetailClient } from '../analysis-detail-client';
import { CleaningClient } from './cleaning-client';

interface CleaningPageProps {
  params: Promise<{ id: string }>;
}

export default async function CleaningPage({ params }: CleaningPageProps) {
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

  const metadata = (analysis.metadata as Record<string, unknown>) || {};
  const cleaning = (metadata as any)?.cleaning;
  const cleaningPlan = (metadata as any)?.cleaningPlan;

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
            <h1 className="text-3xl font-bold">Cleaning</h1>
            <p className="text-muted-foreground mt-1">
              Préparez le plan de nettoyage, validez les actions, puis exécutez.
            </p>
          </div>
          <Link href={`/stock/${id}`}>
            <Button variant="outline">Retour au détail</Button>
          </Link>
        </div>

        <CleaningClient
          analysisId={id}
          status={analysis.status}
          hasStockEntries={(stockEntries?.length || 0) > 0}
          cleaning={cleaning}
          cleaningPlan={cleaningPlan}
        />
      </div>
    </div>
  );
}
