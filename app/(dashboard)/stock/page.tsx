import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function StockPage() {
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

  // SUPER_ADMIN should not access /stock, redirect to /admin
  if (profile.role === 'SUPER_ADMIN') {
    redirect('/admin');
  }

  // USER must have a tenant_id
  if (!profile.tenant_id) {
    redirect('/login');
  }

  // Get analyses for this tenant
  const { data: analyses } = await supabase
    .from('analyses')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get recommendations count
  const { count: recommendationsCount } = await supabase
    .from('recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'pending');

  // Get total analyses count
  const { count: totalAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id);

  // Get completed analyses count
  const { count: completedAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('status', 'completed');

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Health</h1>
          <p className="text-muted-foreground mt-1">
            Analysez et optimisez votre gestion de stock
          </p>
        </div>
        <Link href="/stock/new">
          <Button className="transition-all hover:scale-105 hover:shadow-md">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle analyse
          </Button>
        </Link>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              Analyses totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{totalAnalyses || 0}</div>
            <p className="text-xs text-blue-600 mt-1">
              Analyses créées
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">
              Analyses complétées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{completedAnalyses || 0}</div>
            <p className="text-xs text-green-600 mt-1">
              Analyses terminées
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">
              Recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{recommendationsCount || 0}</div>
            <p className="text-xs text-orange-600 mt-1">
              En attente d'action
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">
              Taux de complétion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">
              {totalAnalyses && totalAnalyses > 0
                ? Math.round((completedAnalyses || 0) / totalAnalyses * 100)
                : 0}%
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Analyses réussies
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Use Cases List */}
      <Card>
        <CardHeader>
          <CardTitle>Analyses récentes</CardTitle>
          <CardDescription>
            Liste de vos analyses de stock (use cases)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyses && analyses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyses.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell className="font-medium">{analysis.name}</TableCell>
                    <TableCell>{analysis.file_name || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          analysis.status === 'completed'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : analysis.status === 'processing'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : analysis.status === 'failed'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {analysis.status === 'completed'
                          ? 'Complétée'
                          : analysis.status === 'processing'
                          ? 'En cours'
                          : analysis.status === 'failed'
                          ? 'Échouée'
                          : 'En attente'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(analysis.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/stock/${analysis.id}`}>
                        <Button variant="ghost" size="sm">
                          Voir
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Aucune analyse pour le moment
              </p>
              <Link href="/stock/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer votre première analyse
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
