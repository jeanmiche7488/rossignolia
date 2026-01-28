import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar, User } from 'lucide-react';
import { isModuleEnabledForTenant, hasModulePermission } from '@/lib/utils/modules';
import { AnalysisDetailClient } from './analysis-detail-client';

interface AnalysisDetailPageProps {
  params: Promise<{
    id: string;
  }>;
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

  // Check if Stock Health module is enabled and user has read permission
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

  // If mapping is pending, redirect to mapping confirmation page
  if (analysis.status === 'mapping_pending') {
    redirect(`/stock/${id}/mapping`);
  }
  if (analysis.status === 'ready_for_cleaning' || analysis.status === 'cleaning_in_progress') {
    redirect(`/stock/${id}/cleaning`);
  }
  if (analysis.status === 'ready_for_analysis' || analysis.status === 'analysis_in_progress') {
    redirect(`/stock/${id}/analysis`);
  }

  // Get stock entries for this analysis
  const { data: stockEntries } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('analysis_id', analysis.id);

  // Get recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('*')
    .eq('analysis_id', analysis.id)
    .order('priority', { ascending: false });

  // Calculate statistics from stock entries
  let totalValue = 0;
  let totalQuantity = 0;
  let uniqueProducts = 0;
  let uniqueSuppliers = 0;
  let uniqueLocations = 0;

  if (stockEntries && stockEntries.length > 0) {
    const skus = new Set<string>();
    const suppliers = new Set<string>();
    const locations = new Set<string>();

    stockEntries.forEach((entry) => {
      if (entry.total_value) {
        totalValue += Number(entry.total_value);
      }
      if (entry.quantity) {
        totalQuantity += Number(entry.quantity);
      }
      if (entry.sku) {
        skus.add(entry.sku);
      }
      if (entry.supplier) {
        suppliers.add(entry.supplier);
      }
      if (entry.location) {
        locations.add(entry.location);
      }
    });

    uniqueProducts = skus.size;
    uniqueSuppliers = suppliers.size;
    uniqueLocations = locations.size;
  }

  // Calculate KPIs from recommendations
  let revenueProtected = 0;
  let capitalReleased = 0;

  if (recommendations) {
    recommendations.forEach((rec) => {
      const impact = rec.estimated_impact as any;
      if (impact) {
        if (rec.type === 'understock' || rec.type === 'low-rotation') {
          const revenue = impact.potential_savings || impact.financial_impact || 0;
          if (typeof revenue === 'number') {
            revenueProtected += revenue;
          }
        }
        if (rec.type === 'dormant' || rec.type === 'overstock' || rec.type === 'slow-moving') {
          const capital = impact.financial_impact || impact.potential_savings || 0;
          if (typeof capital === 'number') {
            capitalReleased += capital;
          }
        }
      }
    });
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      ready_for_cleaning: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      cleaning_in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      ready_for_analysis: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      analysis_in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      mapping_pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };

    const labels: Record<string, string> = {
      completed: 'Complétée',
      processing: 'En cours',
      ready_for_cleaning: 'Prête pour cleaning',
      cleaning_in_progress: 'Cleaning en cours',
      ready_for_analysis: 'Prête pour analyse',
      analysis_in_progress: 'Analyse en cours',
      failed: 'Échouée',
      pending: 'En attente',
      mapping_pending: 'Mapping en attente',
    };

    return (
      <Badge className={variants[status] || variants.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AnalysisDetailClient
        analysisId={id}
        analysisStatus={analysis.status}
        hasStockEntries={(stockEntries?.length || 0) > 0}
        hasRecommendations={(recommendations?.length || 0) > 0}
      />

      <div className="container mx-auto p-8 space-y-6">
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
                Détails de l'analyse
              </p>
            </div>
          </div>
          {getStatusBadge(analysis.status)}
        </div>

      {/* Analysis Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Fichier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{analysis.file_name || 'Aucun fichier'}</p>
            {analysis.file_type && (
              <p className="text-xs text-muted-foreground mt-1">
                Type: {analysis.file_type.toUpperCase()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date de création
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {new Date(analysis.created_at).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(analysis.status)}
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      {analysis.status === 'completed' && stockEntries && stockEntries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Valeur totale</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                }).format(totalValue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stockEntries.length} entrée{stockEntries.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quantité totale</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('fr-FR').format(totalQuantity)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {uniqueProducts} produit{uniqueProducts > 1 ? 's' : ''} unique{uniqueProducts > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Gain potentiel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-700">
                {revenueProtected > 0
                  ? new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    }).format(revenueProtected)
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">CA Sécurisé</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Économie potentielle</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-700">
                {capitalReleased > 0
                  ? new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumFractionDigits: 0,
                    }).format(capitalReleased)
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Cash Libéré</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stock Entries */}
      {stockEntries && stockEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entrées de stock</CardTitle>
            <CardDescription>
              {stockEntries.length} entrée{stockEntries.length > 1 ? 's' : ''} trouvée{stockEntries.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Coût unitaire</TableHead>
                  <TableHead>Valeur totale</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.sku || '-'}</TableCell>
                    <TableCell>{entry.product_name || '-'}</TableCell>
                    <TableCell>{entry.quantity || '-'}</TableCell>
                    <TableCell>
                      {entry.unit_cost ? `${entry.unit_cost.toFixed(2)} €` : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.total_value ? `${entry.total_value.toFixed(2)} €` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommandations</CardTitle>
            <CardDescription>
              {recommendations.length} recommandation{recommendations.length > 1 ? 's' : ''} générée{recommendations.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec) => {
                const impact = rec.estimated_impact as any;
                const actionItems = rec.action_items as Array<{ title: string; description?: string; priority?: string }> || [];
                const affectedSkus = rec.affected_skus as string[] || [];

                return (
                  <div
                    key={rec.id}
                    className="border rounded-lg p-4 space-y-3 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{rec.title}</h4>
                          <Badge
                            variant={
                              rec.priority === 'critical'
                                ? 'destructive'
                                : rec.priority === 'high'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {rec.priority === 'critical' ? 'Critique' : 
                             rec.priority === 'high' ? 'Élevée' : 
                             rec.priority === 'medium' ? 'Moyenne' : 'Basse'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {rec.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {rec.description}
                        </p>
                      </div>
                    </div>

                    {impact && (impact.financial_impact || impact.potential_savings) && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Impact estimé</p>
                        <p className="text-lg font-bold text-blue-900">
                          {impact.financial_impact || impact.potential_savings
                            ? new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: impact.currency || 'EUR',
                                maximumFractionDigits: 0,
                              }).format(impact.financial_impact || impact.potential_savings)
                            : '-'}
                        </p>
                        {impact.timeframe && (
                          <p className="text-xs text-blue-600 mt-1">
                            Délai: {impact.timeframe}
                          </p>
                        )}
                      </div>
                    )}

                    {actionItems.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Actions recommandées</p>
                        <ul className="space-y-1">
                          {actionItems.map((action, index) => (
                            <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="text-blue-600 mt-1">•</span>
                              <span>{action.title}</span>
                              {action.description && (
                                <span className="text-xs text-muted-foreground">- {action.description}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {affectedSkus.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          SKUs concernés ({affectedSkus.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {affectedSkus.slice(0, 10).map((sku) => (
                            <Badge key={sku} variant="outline" className="text-xs">
                              {sku}
                            </Badge>
                          ))}
                          {affectedSkus.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{affectedSkus.length - 10} autres
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {analysis.status === 'mapping_pending' && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-orange-900 font-medium">
              Le mapping des colonnes est en attente de confirmation
            </p>
            <p className="text-sm text-orange-700">
              Vous devez confirmer le mapping des colonnes avant de continuer le traitement.
            </p>
            <Link href={`/stock/${id}/mapping`}>
              <Button className="mt-4">
                Confirmer le mapping
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {analysis.status !== 'mapping_pending' &&
        (!stockEntries || stockEntries.length === 0) &&
        (!recommendations || recommendations.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                L'analyse est en cours de traitement. Les résultats apparaîtront ici une fois terminée.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
