import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Package, TrendingUp, Truck, Shield, Plus, ArrowRight, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default async function DashboardPageV2() {
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

  if (profile.role === 'SUPER_ADMIN') {
    redirect('/admin');
  }

  if (!profile.tenant_id) {
    redirect('/login');
  }

  // Get all analyses (all modules)
  const { data: allAnalyses } = await supabase
    .from('analyses')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get all recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('priority', { ascending: false })
    .limit(5);

  // Global stats
  const { count: totalAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id);

  const { count: processingAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'processing');

  const { count: pendingRecommendations } = await supabase
    .from('recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'pending');

  const { count: completedAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'completed');

  // Stock Health stats
  const { count: stockAnalysesCount } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id);

  const { count: stockRecommendationsCount } = await supabase
    .from('recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'pending');

  const modules = [
    {
      id: 'stock',
      name: 'Stock Health',
      description: 'Audit dormant, rotation, couverture',
      icon: Package,
      href: '/stock',
      status: 'active',
      analysesCount: stockAnalysesCount || 0,
      recommendationsCount: stockRecommendationsCount || 0,
    },
    {
      id: 'demand-planning',
      name: 'Demand Planning',
      description: 'Prévisions de ventes, saisonnalité',
      icon: TrendingUp,
      href: '/demand-planning',
      status: 'coming-soon',
    },
    {
      id: 'transport',
      name: 'Transport Control',
      description: 'Analyse des coûts de fret, optimisation chargement',
      icon: Truck,
      href: '/transport',
      status: 'coming-soon',
    },
    {
      id: 'supplier-risk',
      name: 'Supplier Risk',
      description: 'Analyse fiabilité fournisseurs, délais',
      icon: Shield,
      href: '/supplier-risk',
      status: 'coming-soon',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: 'bg-green-100 text-green-700 border border-green-200',
      processing: 'bg-blue-100 text-blue-700 border border-blue-200',
      failed: 'bg-red-100 text-red-700 border border-red-200',
      pending: 'bg-slate-100 text-slate-700 border border-slate-200',
    };

    const labels: Record<string, string> = {
      completed: 'Complétée',
      processing: 'En cours',
      failed: 'Échouée',
      pending: 'En attente',
    };

    return (
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', variants[status] || variants.pending)}>
        {labels[status] || status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border border-red-200',
      high: 'bg-orange-100 text-orange-700 border border-orange-200',
      medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
      low: 'bg-slate-100 text-slate-700 border border-slate-200',
    };

    return (
      <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', variants[priority] || variants.low)}>
        {priority === 'critical' ? 'Critique' : priority === 'high' ? 'Élevée' : priority === 'medium' ? 'Moyenne' : 'Basse'}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accueil</h1>
          <p className="text-muted-foreground mt-1.5">
            Vue d'ensemble de votre activité
          </p>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              Analyses totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{totalAnalyses || 0}</div>
            <p className="text-xs text-blue-600 mt-1">Tous modules</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              En cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{processingAnalyses || 0}</div>
            <p className="text-xs text-blue-600 mt-1">Analyses en traitement</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">
              Recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{pendingRecommendations || 0}</div>
            <p className="text-xs text-orange-600 mt-1">En attente d'action</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">
              Taux de complétion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {totalAnalyses && totalAnalyses > 0
                ? Math.round((completedAnalyses || 0) / totalAnalyses * 100)
                : 0}%
            </div>
            <p className="text-xs text-green-600 mt-1">Analyses réussies</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Activity + Recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Activité récente</CardTitle>
                <CardDescription>
                  Dernières analyses créées
                </CardDescription>
              </div>
              <Link href="/stock">
                <Button variant="ghost" size="sm">
                  Voir tout
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {allAnalyses && allAnalyses.length > 0 ? (
              <div className="space-y-3">
                {allAnalyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    href={`/stock/${analysis.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(analysis.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 group-hover:text-blue-600">
                          {analysis.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(analysis.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(analysis.status)}
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  Aucune analyse pour le moment
                </p>
                <Link href="/stock/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Créer une analyse
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations - 1/3 width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recommandations</CardTitle>
                <CardDescription>
                  Priorités élevées
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recommendations && recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <Link
                    key={rec.id}
                    href={`/stock/${rec.analysis_id}`}
                    className="block p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      {getPriorityBadge(rec.priority)}
                    </div>
                    <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 mb-1">
                      {rec.title}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {rec.description}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">
                  Aucune recommandation pour le moment
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modules */}
      <Card>
        <CardHeader>
          <CardTitle>Modules disponibles</CardTitle>
          <CardDescription>
            Accédez à vos analyses par module
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => {
              const Icon = module.icon;
              const isActive = module.status === 'active';

              return (
                <div
                  key={module.id}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border transition-all',
                    isActive
                      ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
                      : 'border-slate-200 bg-slate-50/50 opacity-60'
                  )}
                >
                  <div className={cn(
                    'rounded-lg p-2.5',
                    isActive ? 'bg-blue-100 border border-blue-200' : 'bg-slate-100 border border-slate-200'
                  )}>
                    <Icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : 'text-slate-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-slate-900">{module.name}</h3>
                      {!isActive && (
                        <Badge variant="secondary" className="text-xs">Bientôt</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{module.description}</p>
                    {isActive && (
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{module.analysesCount} analyses</span>
                        <span>•</span>
                        <span>{module.recommendationsCount} recommandations</span>
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <Link href={module.href}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
