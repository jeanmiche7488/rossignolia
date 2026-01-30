'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Check, X, Play, Settings, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';

interface CleaningAction {
  id: string;
  description: string;
  enabled: boolean;
  category: 'format' | 'validation' | 'calculation' | 'normalization' | 'inference';
  affectedFields: string[];
  pythonSnippet: string;
}

interface CleaningPlan {
  actions: CleaningAction[];
  pythonCode: string;
  summary: {
    totalRows: number;
    estimatedChanges: number;
    warnings: string[];
  };
  preparedAt?: string;
}

export function CleaningClient({
  analysisId,
  status,
  hasStockEntries,
  cleaning,
  cleaningPlan: initialPlan,
}: {
  analysisId: string;
  status: string;
  hasStockEntries: boolean;
  cleaning: any;
  cleaningPlan?: CleaningPlan | null;
}) {
  const router = useRouter();
  const [preparing, setPreparing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CleaningPlan | null>(initialPlan || null);
  const [showCode, setShowCode] = useState(false);
  const [editedCode, setEditedCode] = useState('');

  useEffect(() => {
    if (plan?.pythonCode) {
      setEditedCode(plan.pythonCode);
    }
  }, [plan?.pythonCode]);

  const isPrepared = status === 'cleaning_prepared' || plan !== null;
  const isExecuted = hasStockEntries || status === 'ready_for_analysis';

  const prepareCleaning = async () => {
    setPreparing(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze/clean/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la préparation');
      }
      const data = await res.json();
      setPlan(data.plan);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la préparation');
    } finally {
      setPreparing(false);
    }
  };

  const executeCleaning = async () => {
    if (!plan) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze/clean/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId,
          actions: plan.actions,
          pythonCode: editedCode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'exécution");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'exécution");
    } finally {
      setExecuting(false);
    }
  };

  const toggleAction = (actionId: string) => {
    if (!plan || isExecuted) return;
    setPlan({
      ...plan,
      actions: plan.actions.map((a) => (a.id === actionId ? { ...a, enabled: !a.enabled } : a)),
    });
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      format: 'Formatage',
      validation: 'Validation',
      calculation: 'Calcul',
      normalization: 'Normalisation',
      inference: 'Inférence',
    };
    return labels[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      format: 'bg-blue-100 text-blue-700',
      validation: 'bg-amber-100 text-amber-700',
      calculation: 'bg-green-100 text-green-700',
      normalization: 'bg-purple-100 text-purple-700',
      inference: 'bg-cyan-100 text-cyan-700',
    };
    return colors[cat] || 'bg-slate-100 text-slate-700';
  };

  const enabledCount = plan?.actions.filter((a) => a.enabled).length || 0;
  const totalCount = plan?.actions.length || 0;

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main action card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm text-slate-700">
                {isExecuted ? (
                  <span className="flex items-center gap-2 text-green-700">
                    <Check className="h-4 w-4" />
                    Cleaning exécuté avec succès
                  </span>
                ) : isPrepared ? (
                  <span className="flex items-center gap-2 text-blue-700">
                    <Settings className="h-4 w-4" />
                    Plan de cleaning prêt — {enabledCount}/{totalCount} actions activées
                  </span>
                ) : (
                  'Préparez le plan de cleaning pour voir les actions proposées'
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Statut: <span className="font-mono">{status}</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {!isPrepared && !isExecuted && (
                <Button onClick={prepareCleaning} disabled={preparing}>
                  {preparing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Préparation...
                    </>
                  ) : (
                    <>
                      <Settings className="mr-2 h-4 w-4" />
                      Préparer le cleaning
                    </>
                  )}
                </Button>
              )}

              {isPrepared && !isExecuted && (
                <Button onClick={executeCleaning} disabled={executing || enabledCount === 0}>
                  {executing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exécution...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Exécuter le cleaning
                    </>
                  )}
                </Button>
              )}

              {isExecuted && (
                <Button
                  variant="default"
                  onClick={() => router.push(`/stock/${analysisId}/analysis`)}
                >
                  Préparer l'analyse →
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions list */}
      {plan && plan.actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions de nettoyage</CardTitle>
            <CardDescription>
              {isExecuted
                ? 'Actions qui ont été exécutées'
                : 'Cochez/décochez les actions à exécuter'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {plan.actions.map((action) => (
                <div
                  key={action.id}
                  className={`rounded border p-3 transition-colors ${
                    action.enabled
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-50 border-slate-100 opacity-60'
                  } ${!isExecuted ? 'cursor-pointer hover:border-blue-300' : ''}`}
                  onClick={() => toggleAction(action.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      {isExecuted ? (
                        action.enabled ? (
                          <div className="h-5 w-5 rounded bg-green-100 flex items-center justify-center">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center">
                            <X className="h-3 w-3 text-slate-400" />
                          </div>
                        )
                      ) : (
                        <input
                          type="checkbox"
                          checked={action.enabled}
                          onChange={() => {}}
                          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(action.category)}`}>
                          {getCategoryLabel(action.category)}
                        </span>
                        {action.affectedFields.length > 0 && (
                          <span className="text-xs text-slate-500">
                            → {action.affectedFields.join(', ')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{action.description}</p>
                      {action.pythonSnippet && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-blue-600">
                            Voir le code
                          </summary>
                          <pre className="mt-1 text-xs bg-slate-100 p-2 rounded overflow-auto">
                            {action.pythonSnippet}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary card */}
      {plan?.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Résumé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border bg-white p-3">
                <div className="text-xs text-muted-foreground">Lignes à traiter</div>
                <div className="text-lg font-semibold">{plan.summary.totalRows}</div>
              </div>
              <div className="rounded border bg-white p-3">
                <div className="text-xs text-muted-foreground">Changements estimés</div>
                <div className="text-lg font-semibold">{plan.summary.estimatedChanges}</div>
              </div>
            </div>
            {plan.summary.warnings?.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-amber-700 mb-1">Avertissements</div>
                <ul className="text-sm text-slate-700 space-y-1">
                  {plan.summary.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Python code editor */}
      {plan?.pythonCode && (
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setShowCode(!showCode)}
            >
              <CardTitle className="text-lg">Code Python (mode avancé)</CardTitle>
              {showCode ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showCode && (
              <CardDescription>
                Modifiez le code si nécessaire. Les changements seront appliqués lors de l'exécution.
              </CardDescription>
            )}
          </CardHeader>
          {showCode && (
            <CardContent>
              <textarea
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                disabled={isExecuted}
                className="w-full h-64 font-mono text-xs p-3 border rounded bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                spellCheck={false}
              />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
