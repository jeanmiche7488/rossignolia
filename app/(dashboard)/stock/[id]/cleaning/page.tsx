import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
              Lancez le nettoyage, puis consultez un résumé des transformations.
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
        />

        {cleaning?.report?.transformations?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Résumé du cleaning</CardTitle>
              <CardDescription>Transformations et éventuels points d’attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Lignes traitées</div>
                  <div className="text-lg font-semibold">{cleaning.report.rowsProcessed ?? '-'}</div>
                </div>
                <div className="rounded border bg-white p-3">
                  <div className="text-xs text-muted-foreground">Lignes nettoyées</div>
                  <div className="text-lg font-semibold">{cleaning.report.rowsCleaned ?? '-'}</div>
                </div>
              </div>

              {cleaning.report.transformations?.length ? (
                <div>
                  <div className="text-sm font-semibold mb-2">Transformations</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {cleaning.report.transformations.map((t: string) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {cleaning.report.issues?.length ? (
                <div>
                  <div className="text-sm font-semibold mb-2">Issues</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {cleaning.report.issues.map((t: string) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Résumé du cleaning</CardTitle>
              <CardDescription>
                Le résumé apparaîtra ici après exécution du cleaning.
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        )}
      </div>
    </div>
  );
}

