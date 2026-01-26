import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, Building2, Users, ArrowRight } from 'lucide-react';

export default async function TenantsPage() {
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

  if (!profile || profile.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  // Get all tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select(`
      *,
      profiles(count)
    `)
    .order('created_at', { ascending: false });

  // Get user count per tenant
  const tenantUserCounts: Record<string, number> = {};
  if (tenants) {
    for (const tenant of tenants) {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      tenantUserCounts[tenant.id] = count || 0;
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground mt-1.5">
            Gérez les organisations et leurs utilisateurs
          </p>
        </div>
        <Link href="/admin/tenants/new">
          <Button className="transition-all hover:scale-105 hover:shadow-md">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau tenant
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des tenants</CardTitle>
          <CardDescription>
            {tenants?.length || 0} tenant{tenants && tenants.length > 1 ? 's' : ''} enregistré{tenants && tenants.length > 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants && tenants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Utilisateurs</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tenant.slug}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span>{tenantUserCounts[tenant.id] || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(tenant.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/tenants/${tenant.id}`}>
                        <Button variant="ghost" size="sm" className="transition-all hover:scale-105">
                          Voir
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-muted-foreground mb-4">
                Aucun tenant pour le moment
              </p>
              <Link href="/admin/tenants/new">
                <Button className="transition-all hover:scale-105 hover:shadow-md">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer le premier tenant
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
