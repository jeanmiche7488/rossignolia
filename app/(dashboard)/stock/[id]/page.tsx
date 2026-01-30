import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { 
  ArrowLeft, 
  AlertTriangle, 
  TrendingUp, 
  Package, 
  Database,
  Zap,
  Target,
  Clock,
  DollarSign,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { isModuleEnabledForTenant, hasModulePermission } from '@/lib/utils/modules';
import { AnalysisDetailClient } from './analysis-detail-client';

interface AnalysisDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Score color helper
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100 border-green-200';
  if (score >= 60) return 'bg-yellow-100 border-yellow-200';
  if (score >= 40) return 'bg-orange-100 border-orange-200';
  return 'bg-red-100 border-red-200';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'À surveiller';
  return 'Critique';
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('fr-FR').format(value);
}

export default async function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  if (!profile.tenant_id) {
    redirect('/login');
  }

  const stockModuleEnabled = await isModuleEnabledForTenant(profile.tenant_id, 'stock');
  if (!stockModuleEnabled) {
    redirect('/dashboard');
  }

  const hasReadPermission = await hasModulePermission(user.id, 'stock', 'read');
  if (!hasReadPermission) {
    redirect('/dashboard');
  }

  // Get analysis
  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (error || !analysis) {
    notFound();
  }

  // Redirects based on status
  if (analysis.status === 'mapping_pending') {
    redirect(`/stock/${id}/mapping`);
  }
  if (analysis.status === 'ready_for_cleaning' || analysis.status === 'cleaning_prepared' || analysis.status === 'cleaning_in_progress') {
    redirect(`/stock/${id}/cleaning`);
  }
  if (analysis.status === 'ready_for_analysis' || analysis.status === 'analysis_in_progress') {
    redirect(`/stock/${id}/analysis`);
  }

  // Get recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('*')
    .eq('analysis_id', analysis.id)
    .order('priority', { ascending: false });

  // Extract facts from metadata
  const meta = analysis.metadata && typeof analysis.metadata === 'object' && !Array.isArray(analysis.metadata)
    ? (analysis.metadata as Record<string, unknown>)
    : {};
  const analysisMeta = (meta as any).analysis || {};
  const facts = analysisMeta.facts_json || {};

  // Extract structured data from facts
  const overview = facts.overview || {};
  const pillars = facts.pillars || {};
  const alerts = facts.alerts || [];
  const executiveSummary = facts.executiveSummary || {};

  // Separate MACRO and MICRO recommendations
  const macroRecos = recommendations?.filter((r) => {
    const impact = r.estimated_impact as any;
    return impact?.level === 'macro';
  }) || [];
  
  const microRecos = recommendations?.filter((r) => {
    const impact = r.estimated_impact as any;
    return impact?.level !== 'macro';
  }) || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      processing: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800',
    };

    const labels: Record<string, string> = {
      completed: 'Complétée',
      processing: 'En cours',
      failed: 'Échouée',
      pending: 'En attente',
    };

    return (
      <Badge className={variants[status] || variants.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-gray-400 text-white',
    };
    const labels: Record<string, string> = {
      critical: 'Critique',
      high: 'Élevée',
      medium: 'Moyenne',
      low: 'Basse',
    };
    return (
      <Badge className={variants[priority] || variants.low}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  // Check if we have proper facts data
  const hasFactsData = overview.totalSkus || pillars.dormancy || executiveSummary.healthScore;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AnalysisDetailClient
        analysisId={id}
        analysisStatus={analysis.status}
        hasStockEntries={true}
        hasRecommendations={(recommendations?.length || 0) > 0}
      />

      <div className="container mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/stock">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{analysis.name}</h1>
              <p className="text-muted-foreground mt-1">
                Analyse complétée le {new Date(analysis.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          {getStatusBadge(analysis.status)}
        </div>

        {/* If no structured facts, show a message about missing data */}
        {!hasFactsData && analysis.status === 'completed' && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-amber-800 mb-2">Données d'analyse manquantes</h3>
              <p className="text-amber-700 mb-4">
                Les KPIs structurés n'ont pas été générés. Cela peut arriver si l'analyse a été effectuée avec une ancienne version du système.
              </p>
              <p className="text-sm text-amber-600">
                Pour obtenir les 4 piliers (Dormancy, Rotation, Obsolescence, Data Quality), relancez l'analyse avec le nouveau format.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Executive Summary Card */}
        {hasFactsData && (
          <Card className="border-2 border-slate-200 bg-white shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Synthèse Executive
              </CardTitle>
              <CardDescription className="text-slate-300">
                Vue d'ensemble de la santé du stock
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-6">
                {/* Health Score */}
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${getScoreBg(executiveSummary.healthScore || 0)}`}>
                    <span className={`text-3xl font-bold ${getScoreColor(executiveSummary.healthScore || 0)}`}>
                      {executiveSummary.healthScore || '-'}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">Score Santé</p>
                  <p className={`text-sm ${getScoreColor(executiveSummary.healthScore || 0)}`}>
                    {getScoreLabel(executiveSummary.healthScore || 0)}
                  </p>
                </div>

                {/* Cash at Risk */}
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <DollarSign className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-700">
                    {formatCurrency(executiveSummary.cashAtRisk)}
                  </p>
                  <p className="text-sm text-red-600 font-medium">Cash à risque</p>
                </div>

                {/* Potential Savings */}
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(executiveSummary.potentialSavings)}
                  </p>
                  <p className="text-sm text-green-600 font-medium">Économies potentielles</p>
                </div>

                {/* Quick Win */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Zap className="h-8 w-8 text-blue-600 mb-2" />
                  <p className="text-sm font-semibold text-blue-800">Quick Win</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {executiveSummary.quickWin || 'Aucun quick win identifié'}
                  </p>
                </div>
              </div>

              {/* Main Risk */}
              {executiveSummary.mainRisk && (
                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800">Risque principal</p>
                    <p className="text-amber-700">{executiveSummary.mainRisk}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Overview Stats */}
        {hasFactsData && (
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="h-10 w-10 text-slate-400" />
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(overview.totalSkus)}</p>
                    <p className="text-sm text-muted-foreground">SKUs analysés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-10 w-10 text-slate-400" />
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(overview.totalQuantity)}</p>
                    <p className="text-sm text-muted-foreground">Quantité totale</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-10 w-10 text-slate-400" />
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(overview.totalValue)}</p>
                    <p className="text-sm text-muted-foreground">Valeur totale</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Target className="h-10 w-10 text-slate-400" />
                  <div>
                    <p className="text-2xl font-bold">{overview.uniqueLocations || '-'}</p>
                    <p className="text-sm text-muted-foreground">Emplacements</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4 Pillars */}
        {hasFactsData && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* DORMANCY */}
            <Card className={`border-2 ${getScoreBg(pillars.dormancy?.score || 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  DORMANCY
                </CardTitle>
                <CardDescription>Stock sans mouvement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <span className={`text-4xl font-bold ${getScoreColor(pillars.dormancy?.score || 0)}`}>
                    {pillars.dormancy?.score || '-'}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SKUs à risque</span>
                    <span className="font-medium">{formatNumber(pillars.dormancy?.skusAtRisk)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valeur à risque</span>
                    <span className="font-medium text-red-600">{formatCurrency(pillars.dormancy?.valueAtRisk)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% du total</span>
                    <span className="font-medium">{pillars.dormancy?.percentOfTotal?.toFixed(1) || '-'}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ROTATION */}
            <Card className={`border-2 ${getScoreBg(pillars.rotation?.score || 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  ROTATION
                </CardTitle>
                <CardDescription>Vitesse du stock</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <span className={`text-4xl font-bold ${getScoreColor(pillars.rotation?.score || 0)}`}>
                    {pillars.rotation?.score || '-'}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rotation moy.</span>
                    <span className="font-medium">{pillars.rotation?.avgRotation?.toFixed(1) || '-'} tours/an</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Low rotation</span>
                    <span className="font-medium">{formatNumber(pillars.rotation?.skusLowRotation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ruptures pot.</span>
                    <span className="font-medium text-orange-600">{formatNumber(pillars.rotation?.potentialStockouts)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OBSOLESCENCE */}
            <Card className={`border-2 ${getScoreBg(pillars.obsolescence?.score || 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  OBSOLESCENCE
                </CardTitle>
                <CardDescription>Long tail & dépréciation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <span className={`text-4xl font-bold ${getScoreColor(pillars.obsolescence?.score || 0)}`}>
                    {pillars.obsolescence?.score || '-'}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Obsolètes pot.</span>
                    <span className="font-medium">{formatNumber(pillars.obsolescence?.potentialObsolete)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valeur à risque</span>
                    <span className="font-medium text-red-600">{formatCurrency(pillars.obsolescence?.valueAtRisk)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DATA QUALITY */}
            <Card className={`border-2 ${getScoreBg(pillars.dataQuality?.score || 0)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  DATA QUALITY
                </CardTitle>
                <CardDescription>Qualité des données</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <span className={`text-4xl font-bold ${getScoreColor(pillars.dataQuality?.score || 0)}`}>
                    {pillars.dataQuality?.score || '-'}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Complétude</span>
                    <span className="font-medium">{pillars.dataQuality?.completeness?.toFixed(0) || '-'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Problèmes</span>
                    <span className="font-medium">{pillars.dataQuality?.issues?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Alertes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.map((alert: any, index: number) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg flex items-start gap-3 ${
                      alert.type === 'critical' ? 'bg-red-50 border border-red-200' :
                      alert.type === 'warning' ? 'bg-amber-50 border border-amber-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    {alert.type === 'critical' ? (
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    ) : alert.type === 'warning' ? (
                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        alert.type === 'critical' ? 'text-red-800' :
                        alert.type === 'warning' ? 'text-amber-800' :
                        'text-blue-800'
                      }`}>
                        {alert.message}
                      </p>
                      {alert.relatedSkus > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.relatedSkus} SKUs concernés
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* MACRO Recommendations */}
        {macroRecos.length > 0 && (
          <Card className="border-2 border-indigo-200">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <Target className="h-5 w-5" />
                Actions Stratégiques (MACRO)
              </CardTitle>
              <CardDescription>
                Décisions pour le COMEX
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {macroRecos.map((rec) => {
                  const impact = rec.estimated_impact as any;
                  const actionItems = rec.action_items as Array<{ title: string; description?: string; priority?: string }> || [];

                  return (
                    <div
                      key={rec.id}
                      className="border-2 border-indigo-100 rounded-lg p-4 space-y-3 hover:border-indigo-300 transition-colors bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold text-lg">{rec.title}</h4>
                            {getPriorityBadge(rec.priority)}
                            <Badge variant="outline" className="text-xs">
                              {impact?.pillar || rec.type}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{rec.description}</p>
                        </div>
                        {impact && (impact.financialImpact || impact.potentialSavings) && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-green-600">
                              {formatCurrency(impact.financialImpact || impact.potentialSavings)}
                            </p>
                            <p className="text-xs text-muted-foreground">{impact.timeframe || 'Impact estimé'}</p>
                          </div>
                        )}
                      </div>

                      {actionItems.length > 0 && (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Actions à mener</p>
                          <ul className="space-y-1">
                            {actionItems.map((action, index) => (
                              <li key={index} className="text-sm flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                <span>{action.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* MICRO Recommendations */}
        {microRecos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Actions Opérationnelles (MICRO)
              </CardTitle>
              <CardDescription>
                Actions concrètes à implémenter
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {microRecos.map((rec) => {
                  const impact = rec.estimated_impact as any;
                  const affectedSkus = rec.affected_skus as string[] || [];

                  return (
                    <div
                      key={rec.id}
                      className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium">{rec.title}</h4>
                            {getPriorityBadge(rec.priority)}
                            <Badge variant="outline" className="text-xs">
                              {impact?.pillar || rec.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.description}</p>
                          
                          {affectedSkus.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {affectedSkus.slice(0, 5).map((sku) => (
                                <Badge key={sku} variant="secondary" className="text-xs">
                                  {sku}
                                </Badge>
                              ))}
                              {affectedSkus.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{affectedSkus.length - 5} autres
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {impact && (impact.financialImpact || impact.potentialSavings) && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(impact.financialImpact || impact.potentialSavings)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No recommendations */}
        {(!recommendations || recommendations.length === 0) && analysis.status === 'completed' && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-medium">Aucune recommandation générée</p>
              <p className="text-muted-foreground mt-2">
                Le stock semble être en bonne santé ou les données sont insuffisantes pour générer des recommandations.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
