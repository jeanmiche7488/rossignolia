'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

export function AnalysisPrepClient({
  analysisId,
  tenantId,
  initialPromptCodegen,
  initialPromptReco,
  initialPython,
  initialPythonGenerated,
  initialFacts,
}: {
  analysisId: string;
  tenantId: string;
  initialPromptCodegen: string;
  initialPromptReco: string;
  initialPython: string;
  initialPythonGenerated: string;
  initialFacts: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [promptCodegen, setPromptCodegen] = useState(initialPromptCodegen);
  const [promptReco, setPromptReco] = useState(initialPromptReco);
  const [python, setPython] = useState(initialPython);
  const [pythonGenerated, setPythonGenerated] = useState(initialPythonGenerated);
  const [facts, setFacts] = useState<Record<string, unknown> | null>(initialFacts);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [runningCodegen, setRunningCodegen] = useState(false);
  const [runningExecute, setRunningExecute] = useState(false);
  const [runningReco, setRunningReco] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCodegen = useMemo(() => promptCodegen.trim().length > 0, [promptCodegen]);
  const canReco = useMemo(() => promptReco.trim().length > 0, [promptReco]);

  const saveConfig = async (opts?: { includePython?: boolean }) => {
    setSavingPrompt(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId,
          promptCodegenOverride: promptCodegen,
          promptRecoOverride: promptReco,
          pythonOverride: opts?.includePython === false ? undefined : python,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSavingPrompt(false);
    }
  };

  const runCodegen = async () => {
    setRunningCodegen(true);
    setError(null);
    try {
      await saveConfig({ includePython: true });
      const res = await fetch('/api/analyze/codegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, promptCodegen }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la génération du Python');
      }
      const data = await res.json();
      const pythonCode = data.pythonCode as string;
      setPythonGenerated(pythonCode || '');
      // Remplir l'éditeur Python si vide (l'utilisateur pourra ensuite le modifier)
      if (!python.trim() && pythonCode) setPython(pythonCode);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération du Python');
    } finally {
      setRunningCodegen(false);
    }
  };

  const runExecute = async () => {
    setRunningExecute(true);
    setError(null);
    try {
      await saveConfig({ includePython: true });
      const res = await fetch('/api/analyze/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l’exécution du Python');
      }
      setFacts(data.facts || null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’exécution du Python');
    } finally {
      setRunningExecute(false);
    }
  };

  const runReco = async () => {
    setRunningReco(true);
    setError(null);
    try {
      await saveConfig({ includePython: true });
      const res = await fetch('/api/analyze/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la génération des recommandations');
      }
      router.push(`/stock/${analysisId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération des recommandations');
    } finally {
      setRunningReco(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>1) Prompt “Codegen Python”</CardTitle>
          <CardDescription>
            Ce prompt sert à générer le script Python (qui s’exécutera sur toutes les lignes via streaming JSONL).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={promptCodegen} onChange={(e) => setPromptCodegen(e.target.value)} className="min-h-[220px]" />
          <div className="flex gap-2">
            <Button onClick={() => saveConfig({ includePython: true })} disabled={savingPrompt || !canCodegen}>
              {savingPrompt ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
            <Button onClick={runCodegen} disabled={runningCodegen || !canCodegen}>
              {runningCodegen ? 'Génération…' : 'Générer le Python'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Python (exécuté)</CardTitle>
          <CardDescription>
            Le Python généré est une base. Vous pouvez le modifier avant exécution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={python} onChange={(e) => setPython(e.target.value)} className="min-h-[220px] font-mono" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveConfig({ includePython: true })} disabled={savingPrompt}>
              {savingPrompt ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
            <Button onClick={runExecute} disabled={runningExecute}>
              {runningExecute ? 'Exécution…' : 'Exécuter le Python'}
            </Button>
          </div>

          {pythonGenerated ? (
            <details className="rounded border bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium">Voir le Python généré (dernière génération)</summary>
              <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap">{pythonGenerated}</pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) Facts (output exécution)</CardTitle>
          <CardDescription>
            Résumé JSON produit par le Python. Gemini produira des recommandations à partir de ces facts (pas des lignes brutes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {facts ? (
            <pre className="text-xs overflow-auto whitespace-pre-wrap rounded border bg-white p-3">
{JSON.stringify(facts, null, 2)}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground">
              Aucun facts disponible. Exécutez le Python.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4) Prompt “Recommandations depuis facts”</CardTitle>
          <CardDescription>
            Ce prompt transforme les facts JSON en recommandations actionnables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={promptReco} onChange={(e) => setPromptReco(e.target.value)} className="min-h-[220px]" />
          <div className="flex gap-2">
            <Button onClick={() => saveConfig({ includePython: true })} disabled={savingPrompt || !canReco}>
              {savingPrompt ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
            <Button onClick={runReco} disabled={runningReco || !canReco || !facts}>
              {runningReco ? 'Génération…' : 'Générer les recommandations'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

