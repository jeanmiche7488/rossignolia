'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/db/supabase-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AnalysisStepper } from '@/components/analysis/analysis-stepper';

// Target schema fields - using English names to match database
// Note: unit_cost_eur is NOT here because it's calculated, not mapped
const TARGET_FIELDS = [
  { code: 'sku', label: 'SKU', description: 'Product identifier', required: true },
  { code: 'product_name', label: 'Product Name', description: 'Product name', required: false },
  { code: 'quantity', label: 'Quantity', description: 'Stock quantity', required: true },
  { code: 'unit_cost', label: 'Unit Cost (Local Currency)', description: 'Cost per unit in original currency', required: false },
  { code: 'local_currency', label: 'Local Currency', description: 'ISO code (EUR, USD, etc.) — can be mapped or inferred from column name (e.g. "Cost USD" → USD)', required: false },
  { code: 'total_value', label: 'Total Value', description: 'Total stock value', required: false },
  { code: 'location', label: 'Location', description: 'Warehouse location', required: false },
  { code: 'category', label: 'Category', description: 'Product category', required: false },
  { code: 'supplier', label: 'Supplier', description: 'Supplier name', required: false },
  { code: 'last_movement_date', label: 'Last Movement Date', description: 'Date of last stock movement', required: false },
  { code: 'days_since_last_movement', label: 'Days Since Last Movement', description: 'Days since last movement', required: false },
];

type AnalysisFileMeta = {
  file_name: string;
  source_type?: string;
  row_count?: number;
};

export default function MappingConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [initialMapping, setInitialMapping] = useState<Record<string, string>>({});
  const [columnSources, setColumnSources] = useState<Record<string, string[]>>({});
  const [files, setFiles] = useState<AnalysisFileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, [analysisId]);

  const loadAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (error) throw error;

      if (data.status === 'mapping_in_progress') {
        router.push(`/stock/${analysisId}/mapping/loading`);
        return;
      }

      if (data.status !== 'mapping_pending') {
        setError(`Unexpected status: ${data.status}`);
        setLoading(false);
        return;
      }

      if (!data.original_columns || !Array.isArray(data.original_columns) || data.original_columns.length === 0) {
        router.push(`/stock/${analysisId}/mapping/loading`);
        return;
      }

      setAnalysis(data);
      const proposedMapping = (data.mapped_columns as Record<string, string>) || {};
      setMapping(proposedMapping);
      setInitialMapping(proposedMapping);

      // Get column sources from metadata
      const metadata = (data.metadata as any) || {};
      const mappingMetadata = metadata.mapping || {};
      setColumnSources(mappingMetadata.column_sources || {});
      setFiles((metadata.files as AnalysisFileMeta[]) || []);
      
      // Load not available fields from metadata
      const notAvailableFromMetadata = mappingMetadata.not_available_fields || [];
      setNotAvailableFields(new Set(notAvailableFromMetadata));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading analysis');
    } finally {
      setLoading(false);
    }
  };

  // Track which fields are marked as "not available"
  const [notAvailableFields, setNotAvailableFields] = useState<Set<string>>(new Set());

  const originalColumns = (analysis?.original_columns as string[]) || [];

  // Columns that exist in a given file
  const getColumnsInFile = (file: AnalysisFileMeta) =>
    originalColumns.filter((col) => (columnSources[col] || []).includes(file.file_name));

  // Column from this file currently mapped to this target
  const getCurrentColForFileTarget = (targetCode: string, file: AnalysisFileMeta) =>
    getColumnsInFile(file).find((col) => mapping[col] === targetCode) ?? null;

  // Column from this file initially (at load) mapped to this target
  const getInitialColForFileTarget = (targetCode: string, file: AnalysisFileMeta) =>
    getColumnsInFile(file).find((col) => initialMapping[col] === targetCode) ?? null;

  // Set mapping for (file, target): newValue is '__no_data__' or a column name
  const setMappingForFileTarget = (file: AnalysisFileMeta, targetCode: string, newValue: string) => {
    const cols = getColumnsInFile(file);
    setMapping((prev) => {
      const next = { ...prev };
      cols.forEach((col) => {
        if (next[col] === targetCode) delete next[col];
      });
      if (newValue !== '__no_data__') next[newValue] = targetCode;
      return next;
    });
  };

  // For card styling: is this target mapped from at least one file?
  const isTargetMapped = (targetCode: string) =>
    files.some((f) => getCurrentColForFileTarget(targetCode, f));

  const markFieldAsNotAvailable = (targetCode: string, mark: boolean) => {
    setNotAvailableFields((prev) => {
      const newSet = new Set(prev);
      if (mark) {
        newSet.add(targetCode);
        // Remove any columns mapped to this field when marking as not available
        setMapping((prevMapping) => {
          const newMapping = { ...prevMapping };
          Object.keys(newMapping).forEach((col) => {
            if (newMapping[col] === targetCode) {
              delete newMapping[col];
            }
          });
          return newMapping;
        });
      } else {
        newSet.delete(targetCode);
      }
      return newSet;
    });
  };

  const handleConfirm = async () => {
    const requiredFields = TARGET_FIELDS.filter((f) => f.required).map((f) => f.code);
    const mappedTargets = Object.values(mapping);
    const missingRequired = requiredFields.filter((req) => {
      // Check if field is mapped OR marked as not available
      return !mappedTargets.includes(req) && !notAvailableFields.has(req);
    });

    if (missingRequired.length > 0) {
      setError(
        `Required fields must be mapped or marked as "Not Available": ${missingRequired.map((code) => TARGET_FIELDS.find((f) => f.code === code)?.label).join(', ')}`
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Store not available fields in metadata
      const confirmedMapping = { ...mapping };
      const notAvailableList = Array.from(notAvailableFields);

      const { error: updateError } = await supabase
        .from('analyses')
        .update({
          mapped_columns: confirmedMapping,
          status: 'ready_for_cleaning',
          metadata: {
            ...(analysis.metadata || {}),
            mapping: {
              ...(analysis.metadata?.mapping || {}),
              confirmed_mapping: confirmedMapping,
              confirmed_at: new Date().toISOString(),
              requires_confirmation: false,
              not_available_fields: notAvailableList, // Store which fields are marked as not available
            },
          },
        })
        .eq('id', analysisId);

      if (updateError) throw updateError;

      router.push(`/stock/${analysisId}/cleaning`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error confirming mapping');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading mapping...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto p-8">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const unmappedColumns = originalColumns.filter((col) => !mapping[col] || mapping[col] === '');

  // Determine analysis steps for stepper
  const steps = [
    { id: 'upload', label: 'Upload', path: `/stock/${analysisId}`, status: 'completed' as const },
    { id: 'mapping', label: 'Mapping', path: `/stock/${analysisId}/mapping`, status: 'in_progress' as const },
    { id: 'cleaning', label: 'Cleaning', path: `/stock/${analysisId}/cleaning`, status: 'pending' as const },
    { id: 'analysis', label: 'Analyse', path: `/stock/${analysisId}/analysis`, status: 'pending' as const },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <AnalysisStepper
        analysisId={analysisId}
        currentStep="mapping"
        steps={steps}
        onClose={() => router.push('/stock')}
      />

      <div className="container mx-auto p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Column Mapping</h1>
          <p className="text-muted-foreground mt-1">
            Map source columns to target fields. The selected column will be used in the final analysis.
          </p>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* One block per target field: one row per file, modify mapping in place */}
        <div className="space-y-3">
          {TARGET_FIELDS.map((target) => {
            const isMapped = isTargetMapped(target.code);
            const isNotAvailable = notAvailableFields.has(target.code);

            return (
              <Card
                key={target.code}
                className={
                  isNotAvailable
                    ? 'border-orange-200 bg-orange-50/50'
                    : isMapped
                    ? 'border-green-200 bg-green-50/50'
                    : target.required
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-slate-200'
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {target.label}
                        {target.required && <span className="text-red-600 text-xs">*</span>}
                        {isMapped && <Check className="h-3.5 w-3.5 text-green-600" />}
                        {isNotAvailable && (
                          <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                            Not Available
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">{target.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {files.length > 0 ? (
                    <div className="space-y-2">
                      {files.map((file) => {
                        const currentCol = getCurrentColForFileTarget(target.code, file);
                        const initialCol = getInitialColForFileTarget(target.code, file);
                        const columnsInFile = getColumnsInFile(file);
                        const isDesaffecte = initialCol != null && initialCol !== currentCol;
                        const isReaffecte = currentCol != null && initialMapping[currentCol] !== target.code;

                        return (
                          <div
                            key={file.file_name}
                            className={`rounded border px-3 py-2 ${
                              isDesaffecte
                                ? 'border-red-200 bg-red-50/50'
                                : isReaffecte
                                ? 'border-emerald-300 bg-emerald-50/50'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                <span className="text-xs font-medium truncate">{file.file_name}</span>
                                {file.source_type && (
                                  <span className="text-[10px] text-slate-500 border border-slate-200 rounded px-1 py-0.5">
                                    {file.source_type}
                                  </span>
                                )}
                                {typeof file.row_count === 'number' && (
                                  <span className="text-[10px] text-slate-500">{file.row_count} lignes</span>
                                )}
                              </div>
                              <select
                                value={currentCol ?? '__no_data__'}
                                onChange={(e) => setMappingForFileTarget(file, target.code, e.target.value)}
                                className="h-8 min-w-[140px] rounded border border-input bg-white px-2 py-1 text-xs"
                              >
                                <option value="__no_data__">No data</option>
                                {columnsInFile.map((col) => (
                                  <option key={col} value={col}>
                                    {col}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {isDesaffecte && (
                              <p className="text-xs text-red-700 mt-1.5 flex items-center gap-1">
                                <span className="font-medium">« {initialCol} »</span>
                                désaffecté (mapping modifié)
                              </p>
                            )}
                            {isReaffecte && (
                              <p className="text-xs text-emerald-700 mt-1.5 flex items-center gap-1">
                                <span className="font-medium">« {currentCol} »</span>
                                réaffecté ici
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {!isNotAvailable && target.required && !isMapped && (
                    <button
                      onClick={() => markFieldAsNotAvailable(target.code, !isNotAvailable)}
                      className="mt-3 w-full text-left text-xs text-orange-600 hover:text-orange-700 py-1.5 px-2 rounded hover:bg-orange-50 transition-colors"
                    >
                      {isNotAvailable
                        ? '✓ Marqué comme non disponible'
                        : '→ Marquer comme "Non disponible" (donnée absente des fichiers)'}
                    </button>
                  )}

                  {isNotAvailable && (
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200 mt-3">
                      <span className="text-xs text-orange-700">
                        Ce champ est marqué "Non disponible" — absent des fichiers chargés.
                      </span>
                      <button
                        onClick={() => markFieldAsNotAvailable(target.code, false)}
                        className="text-xs text-orange-600 hover:text-orange-700 underline"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary of unmapped columns */}
        {unmappedColumns.length > 0 && (
          <Card className="mt-4 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Other Unmapped Columns</CardTitle>
              <CardDescription className="text-xs">
                {unmappedColumns.length} column{unmappedColumns.length > 1 ? 's' : ''} not yet mapped. You can map them above or leave them unmapped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {unmappedColumns.slice(0, 10).map((col) => (
                  <div key={col} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs">
                    <span className="font-medium">{col}</span>
                    {columnSources[col] && (
                      <span className="text-slate-500 text-xs">
                        ({columnSources[col].length === 1 ? columnSources[col][0] : `${columnSources[col].length} files`})
                      </span>
                    )}
                  </div>
                ))}
                {unmappedColumns.length > 10 && (
                  <div className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-500">
                    +{unmappedColumns.length - 10} more
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <Link href={`/stock/${analysisId}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? 'Processing...' : 'Confirm Mapping'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
