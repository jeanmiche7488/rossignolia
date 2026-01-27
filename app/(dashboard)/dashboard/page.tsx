import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Package, TrendingUp, Truck, Shield, Plus, ArrowRight, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getEnabledModulesForTenant, hasModulePermission } from '@/lib/utils/modules';

export default async function DashboardPage() {
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

  // Get recommendations with estimated_impact for KPIs
  const { data: stockRecommendations } = await supabase
    .from('recommendations')
    .select('estimated_impact, type, status')
    .eq('tenant_id', profile.tenant_id)
    .in('status', ['pending', 'in-progress', 'completed']);

  // Calculate KPIs from recommendations
  let revenueProtected = 0; // Gain : Chiffre d'Affaires Sécurisé
  let capitalReleased = 0; // Économie : Cash Libéré

  if (stockRecommendations) {
    stockRecommendations.forEach((rec) => {
      const impact = rec.estimated_impact as any;
      if (impact) {
        // Revenue Protected : pour les recommandations de type "understock" ou "rupture"
        if (rec.type === 'understock' || rec.type === 'low-rotation') {
          const revenue = impact.potential_savings || impact.financial_impact || 0;
          if (typeof revenue === 'number') {
            revenueProtected += revenue;
          }
        }
        // Capital Released : pour les recommandations de type "dormant", "overstock", "slow-moving"
        if (rec.type === 'dormant' || rec.type === 'overstock' || rec.type === 'slow-moving') {
          const capital = impact.financial_impact || impact.potential_savings || 0;
          if (typeof capital === 'number') {
            capitalReleased += capital;
          }
        }
      }
    });
  }

  // Get enabled modules for this tenant
  const enabledModules = await getEnabledModulesForTenant(profile.tenant_id);
  
  // Get user permissions
  const userPermissions = (profile.permissions as any) || { modules: {} };

  // Check access for each module
  const checkModuleAccess = async (moduleCode: string) => {
    const isEnabled = enabledModules.includes(moduleCode);
    if (!isEnabled) {
      return { enabled: false, hasRead: false, hasWrite: false };
    }
    
    const hasRead = await hasModulePermission(user.id, moduleCode, 'read');
    const hasWrite = await hasModulePermission(user.id, moduleCode, 'write');
    
    return { enabled: true, hasRead, hasWrite };
  };

  const allModules = [
    {
      id: 'stock',
      name: 'Stock Health',
      description: 'Audit dormant, rotation, couverture',
      icon: Package,
      href: '/stock',
      moduleCode: 'stock',
    },
    {
      id: 'demand-planning',
      name: 'Demand Planning',
      description: 'Prévisions de ventes, saisonnalité',
      icon: TrendingUp,
      href: '/demand-planning',
      moduleCode: 'demand-planning',
    },
    {
      id: 'transport',
      name: 'Transport Control',
      description: 'Analyse des coûts de fret, optimisation chargement',
      icon: Truck,
      href: '/transport',
      moduleCode: 'transport',
    },
    {
      id: 'supplier-risk',
      name: 'Supplier Risk',
      description: 'Analyse fiabilité fournisseurs, délais',
      icon: Shield,
      href: '/supplier-risk',
      moduleCode: 'supplier-risk',
    },
  ];

  // Check access for all modules
  const modulesWithAccess = await Promise.all(
    allModules.map(async (module) => {
      const access = await checkModuleAccess(module.moduleCode);
      
      if (module.moduleCode === 'stock' && access.hasRead) {
        return {
          ...module,
          status: 'active',
          analysesCount: stockAnalysesCount || 0,
          recommendationsCount: stockRecommendationsCount || 0,
          revenueProtected: revenueProtected,
          capitalReleased: capitalReleased,
          disabled: !access.hasRead,
        };
      }
      
      return {
        ...module,
        status: access.enabled && access.hasRead ? 'active' : 'coming-soon',
        disabled: !access.enabled || !access.hasRead,
      };
    })
  );

  const modules = modulesWithAccess;

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
      {/* Use Cases Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Vos use cases</CardTitle>
          <CardDescription>
            Vue d'ensemble de vos analyses par module avec métriques de performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {modules.map((module) => {
              const Icon = module.icon;
              const isActive = module.status === 'active';
              const isDisabled = module.disabled;

              return isActive && !isDisabled ? (
                <Link
                  key={module.id}
                  href={module.href}
                  className={cn(
                    'flex flex-col gap-5 p-6 rounded-lg border transition-all',
                    'border-blue-200 bg-blue-50/50 hover:border-blue-300 hover:bg-blue-50 hover:shadow-lg hover:scale-[1.02] cursor-pointer group'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg p-3 bg-blue-100 border border-blue-200 group-hover:bg-blue-200 group-hover:scale-110 transition-all">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-slate-900">{module.name}</h3>
                        <p className="text-xs text-slate-600 mt-0.5">{module.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  
                  {/* KPIs Focused Design */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-200">
                    {/* KPI 1: Gain - Revenue Protected */}
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                          Gain
                        </p>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">
                          CA Sécurisé
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-green-700 mb-1">
                        {module.revenueProtected > 0 
                          ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(module.revenueProtected)
                          : '-'}
                      </p>
                      <p className="text-xs text-green-600">
                        {module.revenueProtected > 0 
                          ? 'Ventes protégées grâce aux alertes'
                          : 'Aucun gain enregistré'}
                      </p>
                    </div>

                    {/* KPI 2: Économie - Capital Released */}
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                          Économie
                        </p>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded whitespace-nowrap">
                          Cash Libéré
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700 mb-1">
                        {module.capitalReleased > 0 
                          ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(module.capitalReleased)
                          : '-'}
                      </p>
                      <p className="text-xs text-blue-600">
                        {module.capitalReleased > 0 
                          ? 'Trésorerie libérée sur surstock'
                          : 'Aucune économie enregistrée'}
                      </p>
                    </div>
                  </div>

                  {/* Secondary metrics */}
                  <div className="flex items-center justify-center gap-6 pt-2 border-t border-blue-200">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Analyses</p>
                      <p className="text-sm font-semibold text-slate-700">{module.analysesCount}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">Recommandations</p>
                      <p className="text-sm font-semibold text-slate-700">{module.recommendationsCount}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div
                  key={module.id}
                  className={cn(
                    'flex flex-col gap-4 p-6 rounded-lg border transition-all',
                    'border-slate-200 bg-slate-50/50 opacity-50 cursor-not-allowed grayscale'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg p-3 bg-slate-100 border border-slate-200">
                        <Icon className="h-6 w-6 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg text-slate-500">{module.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {isDisabled ? 'Non activé' : 'Bientôt'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{module.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                <Button variant="ghost" size="sm" className="transition-all hover:bg-slate-100">
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
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(analysis.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
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
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
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
                  <Button size="sm" className="transition-all hover:scale-105 hover:shadow-md">
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
                    className="block p-3 rounded-lg border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      {getPriorityBadge(rec.priority)}
                    </div>
                    <p className="text-sm font-medium text-slate-900 group-hover:text-orange-600 transition-colors mb-1">
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
    </div>
  );
}
