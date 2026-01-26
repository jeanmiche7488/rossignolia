import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar, User } from 'lucide-react';

interface AnalysisDetailPageProps {
  params: {
    id: string;
  };
}

export default async function AnalysisDetailPage({ params }: AnalysisDetailPageProps) {
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

  // Get analysis
  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (error || !analysis) {
    notFound();
  }

  // Get stock entries for this analysis
  const { data: stockEntries } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('analysis_id', analysis.id)
    .limit(100);

  // Get recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('*')
    .eq('analysis_id', analysis.id)
    .order('priority', { ascending: false });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
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

  return (
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
            <p className="text-sm capitalize">{analysis.status}</p>
          </CardContent>
        </Card>
      </div>

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
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{rec.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rec.description}
                      </p>
                    </div>
                    <Badge
                      variant={
                        rec.priority === 'critical'
                          ? 'destructive'
                          : rec.priority === 'high'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {rec.priority}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Type: {rec.type}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!stockEntries || stockEntries.length === 0) &&
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
  );
}
