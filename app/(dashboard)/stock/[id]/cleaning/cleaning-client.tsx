'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export function CleaningClient({
  analysisId,
  status,
  hasStockEntries,
  cleaning,
}: {
  analysisId: string;
  status: string;
  hasStockEntries: boolean;
  cleaning: any;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = !running && !hasStockEntries;

  const runCleaning = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors du lancement du cleaning');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du lancement du cleaning');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        {error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-700">
            {hasStockEntries
              ? 'Cleaning déjà effectué (stock_entries présents).'
              : 'Cleaning non exécuté. Cliquez pour lancer.'}
            <div className="text-xs text-muted-foreground mt-1">
              Statut analyse: <span className="font-mono">{status}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={runCleaning} disabled={!canRun}>
              {running ? 'Cleaning en cours…' : 'Lancer le cleaning'}
            </Button>
            <Button
              variant="outline"
              disabled={!hasStockEntries}
              onClick={() => router.push(`/stock/${analysisId}/analysis`)}
            >
              Passer à l’analyse
            </Button>
          </div>
        </div>

        {cleaning?.pythonCode ? (
          <details className="rounded border bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Voir le code Python (white-box) du cleaning
            </summary>
            <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap">
{String(cleaning.pythonCode)}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

