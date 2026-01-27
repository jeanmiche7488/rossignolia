import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Plus, Users, Building2, Mail, Calendar, Edit, Trash2 } from 'lucide-react';
import { TenantModulesManager } from './tenant-modules-manager';

interface TenantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
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

  const { id } = await params;

  // Get tenant details
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (tenantError || !tenant) {
    notFound();
  }

  // Get all users for this tenant
  const { data: tenantUsers } = await supabase
    .from('profiles')
    .select('*')
    .eq('tenant_id', id)
    .order('created_at', { ascending: false });

  // Get analyses count for this tenant
  const { count: analysesCount } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', id);

  // Get all available modules
  const { data: allModules } = await supabase
    .from('modules')
    .select('*')
    .order('name', { ascending: true });

  // Get tenant modules with module details
  const { data: tenantModulesData } = await supabase
    .from('tenant_modules')
    .select(`
      module_id,
      enabled,
      modules:module_id (
        id,
        code,
        name,
        description
      )
    `)
    .eq('tenant_id', id);

  const getRoleBadge = (role: string) => {
    const variants: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-700 border border-purple-200',
      ADMIN: 'bg-blue-100 text-blue-700 border border-blue-200',
      USER: 'bg-slate-100 text-slate-700 border border-slate-200',
    };

    return (
      <Badge className={variants[role] || variants.USER}>
        {role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'ADMIN' ? 'Admin' : 'Utilisateur'}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/tenants">
            <Button variant="ghost" size="sm" className="transition-all hover:scale-105">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-muted-foreground mt-1.5">
              Détails du tenant et gestion des utilisateurs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/tenants/${id}/edit`}>
            <Button variant="outline" className="transition-all hover:scale-105">
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Button>
          </Link>
          <Link href="/admin/users/new">
            <Button className="transition-all hover:scale-105 hover:shadow-md">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un utilisateur
            </Button>
          </Link>
        </div>
      </div>

      {/* Tenant Info Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantUsers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Utilisateurs actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Analyses réalisées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slug</CardTitle>
            <Badge variant="outline" className="text-xs">{tenant.slug}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Identifiant unique
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Créé le {new Date(tenant.created_at).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Management */}
      {allModules && (
        <TenantModulesManager
          tenantId={id}
          modules={allModules}
          tenantModules={(tenantModulesData || []).map((tm: any) => ({
            module_id: tm.module_id,
            enabled: tm.enabled,
            module: tm.modules,
          }))}
        />
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs du tenant</CardTitle>
          <CardDescription>
            {tenantUsers?.length || 0} utilisateur{tenantUsers && tenantUsers.length > 1 ? 's' : ''} associé{tenantUsers && tenantUsers.length > 1 ? 's' : ''} à ce tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantUsers && tenantUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantUsers.map((userProfile) => (
                  <TableRow key={userProfile.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">
                      {userProfile.full_name || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span>{userProfile.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(userProfile.role)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">
                          {new Date(userProfile.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/users/${userProfile.id}`}>
                        <Button variant="ghost" size="sm" className="transition-all hover:scale-105">
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
              <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-muted-foreground mb-4">
                Aucun utilisateur associé à ce tenant
              </p>
              <Link href="/admin/users/new">
                <Button className="transition-all hover:scale-105 hover:shadow-md">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter le premier utilisateur
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
