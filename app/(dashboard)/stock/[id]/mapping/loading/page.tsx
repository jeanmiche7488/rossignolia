'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/db/supabase-client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, FileText, Database, Map } from 'lucide-react';

type MappingStatus = 'starting' | 'analyzing_files' | 'detecting_columns' | 'mapping_columns' | 'completed' | 'failed';

export default function MappingLoadingPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();
  const analysisId = params.id as string;

  const [status, setStatus] = useState<MappingStatus>('starting');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Démarrage du mapping...');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    filesProcessed: 0,
    totalFiles: 0,
    columnsDetected: 0,
    columnsMapped: 0,
  });

  useEffect(() => {
    pollMappingStatus();
    const interval = setInterval(pollMappingStatus, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [analysisId]);

  const pollMappingStatus = async () => {
    try {
      const { data: analysis, error: fetchError } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (fetchError) {
        console.error('[Mapping Loading] Erreur:', fetchError);
        return;
      }

      if (!analysis) return;

      const metadata = (analysis.metadata as any) || {};
      const mappingMetadata = metadata.mapping || {};

      // Update stats from metadata
      if (metadata.files) {
        setStats(prev => ({
          ...prev,
          totalFiles: metadata.aggregated_from || 0,
        }));
      }

      if (analysis.original_columns && Array.isArray(analysis.original_columns)) {
        setStats(prev => ({
          ...prev,
          columnsDetected: analysis.original_columns.length,
        }));
      }

      if (analysis.mapped_columns && typeof analysis.mapped_columns === 'object') {
        setStats(prev => ({
          ...prev,
          columnsMapped: Object.keys(analysis.mapped_columns).length,
        }));
      }

      // Determine status based on analysis state
      if (analysis.status === 'failed') {
        setStatus('failed');
        setError(mappingMetadata.error || 'Erreur lors du mapping');
        setMessage('Erreur lors du mapping');
        return;
      }

      if (analysis.status === 'mapping_pending') {
        // Mapping is complete!
        setStatus('completed');
        setProgress(100);
        setMessage('Mapping terminé avec succès');
        
        // Wait a moment to show completion, then redirect
        setTimeout(() => {
          router.push(`/stock/${analysisId}/mapping`);
        }, 1500);
        return;
      }

      if (analysis.status === 'mapping_in_progress') {
        // Determine sub-status based on what data is available
        if (!analysis.original_columns || (Array.isArray(analysis.original_columns) && analysis.original_columns.length === 0)) {
          // Still analyzing files
          setStatus('analyzing_files');
          setProgress(25);
          setMessage(`Analyse de ${stats.totalFiles || '?'} fichier(s)...`);
        } else if (analysis.original_columns && Array.isArray(analysis.original_columns) && analysis.original_columns.length > 0) {
          if (!analysis.mapped_columns || Object.keys(analysis.mapped_columns).length === 0) {
            // Columns detected, mapping in progress
            setStatus('mapping_columns');
            setProgress(75);
            setMessage(`Génération du mapping pour ${stats.columnsDetected} colonne(s)...`);
          } else {
            // Mapping almost done
            setStatus('mapping_columns');
            setProgress(90);
            setMessage('Finalisation du mapping...');
          }
        } else {
          setStatus('detecting_columns');
          setProgress(50);
          setMessage('Détection des colonnes...');
        }
      }
    } catch (err) {
      console.error('[Mapping Loading] Erreur lors du polling:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setStatus('failed');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-12 w-12 text-green-600 animate-in fade-in" />;
      case 'failed':
        return <AlertCircle className="h-12 w-12 text-red-600" />;
      default:
        return <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />;
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { 
        key: 'analyzing_files', 
        label: 'Analyse des fichiers', 
        icon: FileText,
        active: ['analyzing_files', 'detecting_columns', 'mapping_columns', 'completed'].includes(status),
        completed: ['detecting_columns', 'mapping_columns', 'completed'].includes(status),
      },
      { 
        key: 'detecting_columns', 
        label: 'Détection des colonnes', 
        icon: Database,
        active: ['detecting_columns', 'mapping_columns', 'completed'].includes(status),
        completed: ['mapping_columns', 'completed'].includes(status),
      },
      { 
        key: 'mapping_columns', 
        label: 'Génération du mapping', 
        icon: Map,
        active: ['mapping_columns', 'completed'].includes(status),
        completed: status === 'completed',
      },
    ];

    return steps;
  };

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center space-y-8">
              {/* Main Status Icon */}
              <div className="flex items-center justify-center">
                {getStatusIcon()}
              </div>

              {/* Progress Message */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">{message}</h2>
                {status !== 'completed' && status !== 'failed' && (
                  <p className="text-sm text-muted-foreground">
                    Veuillez patienter, cette opération peut prendre quelques secondes...
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              {status !== 'completed' && status !== 'failed' && (
                <div className="w-full space-y-2">
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">{progress}%</p>
                </div>
              )}

              {/* Status Steps */}
              <div className="w-full space-y-4">
                {getStatusSteps().map((step, index) => {
                  const Icon = step.icon;
                  const isActive = step.active && !step.completed;
                  const isCompleted = step.completed;

                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                        isActive
                          ? 'border-blue-200 bg-blue-50'
                          : isCompleted
                          ? 'border-green-200 bg-green-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          isCompleted
                            ? 'bg-green-100 text-green-600'
                            : isActive
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : isActive ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-slate-500'
                          }`}
                        >
                          {step.label}
                        </p>
                        {isActive && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.key === 'analyzing_files' && `${stats.filesProcessed}/${stats.totalFiles} fichier(s) analysé(s)`}
                            {step.key === 'detecting_columns' && `${stats.columnsDetected} colonne(s) détectée(s)`}
                            {step.key === 'mapping_columns' && `${stats.columnsMapped} colonne(s) mappée(s)`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats */}
              {(stats.columnsDetected > 0 || stats.columnsMapped > 0) && (
                <div className="w-full grid grid-cols-2 gap-4 text-sm">
                  {stats.totalFiles > 0 && (
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{stats.totalFiles}</p>
                      <p className="text-xs text-muted-foreground">Fichier(s)</p>
                    </div>
                  )}
                  {stats.columnsDetected > 0 && (
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{stats.columnsDetected}</p>
                      <p className="text-xs text-muted-foreground">Colonne(s) détectée(s)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">Erreur</p>
                  </div>
                  <p className="text-sm text-red-700 mt-2">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
