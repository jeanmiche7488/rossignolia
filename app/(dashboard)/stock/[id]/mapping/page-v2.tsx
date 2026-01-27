'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/db/supabase-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading analysis');
    } finally {
      setLoading(false);
    }
  };

  // Group columns by target field
  const groupedByTarget = () => {
    const groups: Record<string, ColumnWithSource[]> = {};
    
    TARGET_FIELDS.forEach((target) => {
      groups[target.code] = [];
    });

    const originalColumns = (analysis?.original_columns as string[]) || [];
    originalColumns.forEach((col) => {
      const targetField = mapping[col];
      if (targetField && groups[targetField]) {
        groups[targetField].push({
          column: col,
          sourceFiles: columnSources[col] || ['Unknown'],
        });
      }
    });

    return groups;
  };

  const updateMapping = (sourceColumn: string, targetField: string) => {
    setMapping((prev) => {
      const newMapping = { ...prev };
      if (targetField === '') {
        delete newMapping[sourceColumn];
      } else {
        newMapping[sourceColumn] = targetField;
      }
      return newMapping;
    });
  };

  const handleConfirm = async () => {
    const requiredFields = TARGET_FIELDS.filter((f) => f.required).map((f) => f.code);
    const mappedTargets = Object.values(mapping);
    const missingRequired = requiredFields.filter((req) => !mappedTargets.includes(req));

    if (missingRequired.length > 0) {
      setError(
        `Required fields not mapped: ${missingRequired.map((code) => TARGET_FIELDS.find((f) => f.code === code)?.label).join(', ')}`
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('analyses')
        .update({
          mapped_columns: mapping,
          status: 'processing',
          metadata: {
            ...(analysis.metadata || {}),
            mapping: {
              ...(analysis.metadata?.mapping || {}),
              confirmed_mapping: mapping,
              confirmed_at: new Date().toISOString(),
              requires_confirmation: false,
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
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading mapping...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
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
        <div className="space-y-6">
          {TARGET_FIELDS.map((target) => {
            const columns = groups[target.code] || [];
            const isMapped = columns.length > 0;

            return (
              <Card key={target.code} className={isMapped ? 'border-green-200 bg-green-50/50' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {target.label}
                        {target.required && <span className="text-red-600 text-sm">*</span>}
                        {isMapped && <Check className="h-5 w-5 text-green-600" />}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">{target.description}</CardDescription>
                    </div>
                    {isMapped && (
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                        {columns.length} source column{columns.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {columns.length > 0 ? (
                    <div className="space-y-2">
                      {columns.map(({ column, sourceFiles }) => (
                        <div
                          key={column}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{column}</span>
                              <span className="text-xs text-muted-foreground">→</span>
                              <span className="text-sm font-semibold text-green-700">{target.label}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <FileText className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-500">
                                {sourceFiles.length === 1
                                  ? sourceFiles[0]
                                  : `${sourceFiles.length} files: ${sourceFiles.join(', ')}`}
                              </span>
                            </div>
                          </div>
                          <select
                            value={target.code}
                            onChange={(e) => updateMapping(column, e.target.value)}
                            className="flex h-8 w-48 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                          >
                            <option value="">-- Unmap --</option>
                            {TARGET_FIELDS.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.label} {t.required && '*'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No columns mapped yet. Select a source column below.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Unmapped Columns */}
        {unmappedColumns.length > 0 && (
          <Card className="mt-6 border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Unmapped Columns</CardTitle>
              <CardDescription>Map these columns to target fields or leave unmapped</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unmappedColumns.map((col) => (
                  <div key={col} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                    <div className="flex-1">
                      <span className="font-medium text-sm">{col}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {columnSources[col]?.join(', ') || 'Unknown source'}
                        </span>
                      </div>
                    </div>
                    <select
                      value={mapping[col] || ''}
                      onChange={(e) => updateMapping(col, e.target.value)}
                      className="flex h-8 w-48 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    >
                      <option value="">-- Not mapped --</option>
                      {TARGET_FIELDS.map((target) => (
                        <option key={target.code} value={target.code}>
                          {target.label} {target.required && '*'}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
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
