'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Code, Sparkles, CheckCircle2, AlertCircle, Zap, FileCode, Rocket } from 'lucide-react';

export function AnalysisPrepClient({
  analysisId,
  tenantId,
  initialPromptCodegen,
  initialPython,
  initialPythonGenerated,
  initialFacts,
}: {
  analysisId: string;
  tenantId: string;
  initialPromptCodegen: string;
  initialPromptReco?: string;
  initialPython: string;
  initialPythonGenerated: string;
  initialFacts: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [promptCodegen, setPromptCodegen] = useState(initialPromptCodegen);
  const [python, setPython] = useState(initialPython || initialPythonGenerated);
  const [pythonGenerated, setPythonGenerated] = useState(initialPythonGenerated);
  const [facts, setFacts] = useState<Record<string, unknown> | null>(initialFacts);
  
  const [runningCodegen, setRunningCodegen] = useState(false);
  const [codegenSuccess, setCodegenSuccess] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCodegen = useMemo(() => promptCodegen.trim().length > 0, [promptCodegen]);
  const canRunAnalysis = useMemo(() => python.trim().length > 0, [python]);
  const hasPython = python.trim().length > 0;

  const runCodegen = async () => {
    setRunningCodegen(true);
    setCodegenSuccess(false);
    setError(null);
    try {
      console.log('[Codegen] Saving config...');
      await fetch('/api/analyze/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, promptCodegenOverride: promptCodegen }),
      });

      console.log('[Codegen] Calling codegen API...');
      const res = await fetch('/api/analyze/codegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, promptCodegen }),
      });
      
      const data = await res.json().catch(() => ({}));
      console.log('[Codegen] Response status:', res.status);
      
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la génération du Python');
      }
      
      const pythonCode = data.pythonCode as string;
      console.log('[Codegen] Python code length:', pythonCode?.length || 0);
      
      if (pythonCode) {
        setPythonGenerated(pythonCode);
        setPython(pythonCode);
        setCodegenSuccess(true);
        console.log('[Codegen] State updated with python code');
      } else {
        console.warn('[Codegen] No python code in response!');
        setError('Le code Python n\'a pas été généré. Vérifiez les logs serveur.');
      }
    } catch (e) {
      console.error('[Codegen] Error:', e);
      setError(e instanceof Error ? e.message : 'Erreur lors de la génération du Python');
    } finally {
      setRunningCodegen(false);
    }
  };

  const runFullAnalysis = async () => {
    setRunningAnalysis(true);
    setError(null);
    console.log('[Analysis] Starting full analysis...');
    try {
      // Step 1: Save Python
      setCurrentStep('Sauvegarde de la configuration...');
      console.log('[Analysis] Step 1: Saving config...');
      console.log('[Analysis] Python to save - length:', python.length);
      console.log('[Analysis] Python to save - first 100 chars:', python.substring(0, 100));
      const configRes = await fetch('/api/analyze/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, pythonOverride: python }),
      });
      console.log('[Analysis] Config saved, status:', configRes.status);

      // Step 2: Execute Python
      setCurrentStep('Exécution du script Python (calcul des facts)...');
      console.log('[Analysis] Step 2: Executing Python...');
      const execRes = await fetch('/api/analyze/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      const execData = await execRes.json().catch(() => ({}));
      console.log('[Analysis] Execute response:', execRes.status, execData);
      if (!execRes.ok) {
        throw new Error(execData.error || "Erreur lors de l'exécution du Python");
      }
      setFacts(execData.facts || null);

      // Step 3: Generate recommendations
      setCurrentStep('Génération des recommandations stratégiques...');
      console.log('[Analysis] Step 3: Generating recommendations...');
      const recoRes = await fetch('/api/analyze/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });
      const recoData = await recoRes.json().catch(() => ({}));
      console.log('[Analysis] Recommend response:', recoRes.status, recoData);
      if (!recoRes.ok) {
        throw new Error(recoData.error || 'Erreur lors de la génération des recommandations');
      }

      // Success - redirect to analysis detail
      setCurrentStep('Analyse terminée ! Redirection...');
      console.log('[Analysis] Success! Redirecting...');
      router.push(`/stock/${analysisId}`);
      router.refresh();
    } catch (e) {
      console.error('[Analysis] Error:', e);
      setError(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    } finally {
      setRunningAnalysis(false);
      setCurrentStep(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Erreur</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {currentStep && (
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="relative">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <div className="absolute inset-0 h-6 w-6 animate-ping opacity-30 rounded-full bg-blue-400" />
          </div>
          <div>
            <p className="font-medium text-blue-800">Analyse en cours</p>
            <p className="text-sm text-blue-600">{currentStep}</p>
          </div>
        </div>
      )}

      {/* Step 1: Prompt for Python generation */}
      <Card className="border-2 border-slate-200 hover:border-slate-300 transition-colors">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <FileCode className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Étape 1 — Générer le script d'analyse</CardTitle>
              <CardDescription>
                Décrivez ce que vous souhaitez analyser. L'IA générera un script Python optimisé.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <Textarea 
            value={promptCodegen} 
            onChange={(e) => setPromptCodegen(e.target.value)} 
            className="min-h-[140px] text-sm border-2 focus:border-blue-300 transition-colors"
            placeholder="Ex: Analyser le stock dormant, identifier les surstocks, calculer la valeur bloquée..."
          />
          <div className="flex items-center gap-3">
            <Button 
              onClick={runCodegen} 
              disabled={runningCodegen || !canCodegen || runningAnalysis}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {runningCodegen ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Code className="mr-2 h-4 w-4" />
                  Générer le script
                </>
              )}
            </Button>
            {codegenSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Script généré avec succès
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Python editor */}
      <Card className={`border-2 transition-all ${hasPython ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
        <CardHeader className={`${hasPython ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-slate-50 to-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg shadow-sm ${hasPython ? 'bg-emerald-100' : 'bg-white'}`}>
              <Zap className={`h-5 w-5 ${hasPython ? 'text-emerald-600' : 'text-slate-600'}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Étape 2 — Lancer l'analyse</CardTitle>
              <CardDescription>
                Vérifiez le script, modifiez-le si besoin, puis lancez l'analyse complète.
              </CardDescription>
            </div>
            {hasPython && (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                {python.split('\n').length} lignes
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <Textarea 
            value={python} 
            onChange={(e) => setPython(e.target.value)} 
            className="min-h-[280px] font-mono text-xs border-2 focus:border-emerald-300 transition-colors bg-slate-900 text-slate-100 rounded-lg"
            placeholder="Le script Python apparaîtra ici après génération..."
            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
          />
          
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              {!hasPython && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  Générez d'abord un script (étape 1)
                </span>
              )}
            </div>
            <Button 
              onClick={runFullAnalysis} 
              disabled={runningAnalysis || !canRunAnalysis || runningCodegen}
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
            >
              {runningAnalysis ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  Lancer l'analyse complète
                </>
              )}
            </Button>
          </div>

          {/* Facts preview (collapsed by default, shown only if available) */}
          {facts && (
            <details className="rounded-lg border-2 border-slate-200 bg-white p-3 mt-4">
              <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Voir les facts générés (debug)
              </summary>
              <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap max-h-64 bg-slate-50 p-3 rounded">
                {JSON.stringify(facts, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
