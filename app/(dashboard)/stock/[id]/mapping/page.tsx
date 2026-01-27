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
const TARGET_FIELDS = [
  { code: 'sku', label: 'SKU', description: 'Product identifier', required: true },
  { code: 'product_name', label: 'Product Name', description: 'Product name', required: false },
  { code: 'quantity', label: 'Quantity', description: 'Stock quantity', required: true },
  { code: 'unit_cost', label: 'Unit Cost', description: 'Cost per unit', required: false },
  { code: 'total_value', label: 'Total Value', description: 'Total stock value', required: false },
  { code: 'location', label: 'Location', description: 'Warehouse location', required: false },
  { code: 'category', label: 'Category', description: 'Product category', required: false },
  { code: 'supplier', label: 'Supplier', description: 'Supplier name', required: false },
  { code: 'last_movement_date', label: 'Last Movement Date', description: 'Date of last stock movement', required: false },
  { code: 'days_since_last_movement', label: 'Days Since Last Movement', description: 'Days since last movement', required: false },
];

type ColumnWithSource = {
  column: string;
  sourceFiles: string[];
};

export default function MappingConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [columnSources, setColumnSources] = useState<Record<string, string[]>>({});
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
      
      // Get column sources from metadata
      const metadata = (data.metadata as any) || {};
      const mappingMetadata = metadata.mapping || {};
      setColumnSources(mappingMetadata.column_sources || {});
      
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

  // Group columns by target field
  const groupedByTarget = () => {
    const groups: Record<string, ColumnWithSource[]> = {};
    
    TARGET_FIELDS.forEach((target) => {
      groups[target.code] = [];
    });

    const originalColumns = (analysis?.original_columns as string[]) || [];
    originalColumns.forEach((col) => {
      const targetField = mapping[col];
      if (targetField && groups[targetField] && targetField !== '__not_available__') {
        groups[targetField].push({
          column: col,
          sourceFiles: columnSources[col] || ['Unknown'],
        });
      }
    });

    return groups;
  };

  // Get unmapped columns for a specific target field
  const getUnmappedColumnsForTarget = (targetCode: string) => {
    const originalColumns = (analysis?.original_columns as string[]) || [];
    return originalColumns.filter((col) => {
      const mappedTo = mapping[col];
      return !mappedTo || mappedTo === '' || mappedTo === '__not_available__';
    });
  };

  const updateMapping = (sourceColumn: string, targetField: string) => {
    setMapping((prev) => {
      const newMapping = { ...prev };
      if (targetField === '' || targetField === '__unmap__') {
        delete newMapping[sourceColumn];
      } else {
        newMapping[sourceColumn] = targetField;
      }
      return newMapping;
    });
  };

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
          status: 'processing',
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

      const processResponse = await fetch('/api/analyze/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Error starting cleaning phase');
      }

      router.push(`/stock/${analysisId}`);
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

  const groups = groupedByTarget();
  const originalColumns = (analysis?.original_columns as string[]) || [];
  const unmappedColumns = originalColumns.filter((col) => !mapping[col] || mapping[col] === '');

  // Determine analysis steps for stepper
  const steps = [
    { id: 'upload', label: 'Upload', path: `/stock/${analysisId}`, status: 'completed' as const },
    { id: 'mapping', label: 'Mapping', path: `/stock/${analysisId}/mapping`, status: 'in_progress' as const },
    { id: 'cleaning', label: 'Cleaning', path: `/stock/${analysisId}`, status: 'pending' as const },
    { id: 'analysis', label: 'Analysis', path: `/stock/${analysisId}`, status: 'pending' as const },
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

        {/* Grouped by Target Field */}
        <div className="space-y-3">
          {TARGET_FIELDS.map((target) => {
            const columns = groups[target.code] || [];
            const isMapped = columns.length > 0;
            const isNotAvailable = notAvailableFields.has(target.code);
            const unmappedColumns = getUnmappedColumnsForTarget(target.code);

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
                        {isNotAvailable && <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Not Available</span>}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">{target.description}</CardDescription>
                    </div>
                    {isMapped && (
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                        {columns.length} source{columns.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {/* Mapped columns */}
                  {columns.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {columns.map(({ column, sourceFiles }) => (
                        <div
                          key={column}
                          className="flex items-center gap-2 p-2 bg-white rounded border border-green-200 hover:border-green-300 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs truncate">{column}</span>
                              <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              <span className="text-xs font-semibold text-green-700">{target.label}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <FileText className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                              <span className="text-xs text-slate-500 truncate">
                                {sourceFiles.length === 1
                                  ? sourceFiles[0]
                                  : `${sourceFiles.length} files: ${sourceFiles.slice(0, 2).join(', ')}${sourceFiles.length > 2 ? '...' : ''}`}
                              </span>
                            </div>
                          </div>
                          <select
                            value={target.code}
                            onChange={(e) => updateMapping(column, e.target.value)}
                            className="flex h-7 w-32 rounded border border-input bg-transparent px-1.5 py-0.5 text-xs"
                          >
                            <option value="__unmap__">-- Unmap --</option>
                            {TARGET_FIELDS.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.label} {t.required && '*'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add column manually */}
                  {!isNotAvailable && (
                    <div className="space-y-1.5">
                      {unmappedColumns.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              updateMapping(e.target.value, target.code);
                              e.target.value = '';
                            }
                          }}
                          className="flex h-7 w-full rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 transition-colors"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            + Map a column to {target.label}...
                          </option>
                          {unmappedColumns.map((col) => (
                            <option key={col} value={col}>
                              {col} {columnSources[col] && `(${columnSources[col].join(', ')})`}
                            </option>
                          ))}
                        </select>
                      )}

                      {target.required && !isMapped && (
                        <button
                          onClick={() => markFieldAsNotAvailable(target.code, !isNotAvailable)}
                          className="w-full text-left text-xs text-orange-600 hover:text-orange-700 py-1 px-2 rounded hover:bg-orange-50 transition-colors"
                        >
                          {isNotAvailable ? '✓ Marked as not available' : '→ Mark as "Not Available" (data not in files)'}
                        </button>
                      )}
                    </div>
                  )}

                  {isNotAvailable && (
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                      <span className="text-xs text-orange-700">
                        This field is marked as "Not Available" - data is not present in the uploaded files.
                      </span>
                      <button
                        onClick={() => markFieldAsNotAvailable(target.code, false)}
                        className="text-xs text-orange-600 hover:text-orange-700 underline"
                      >
                        Undo
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
