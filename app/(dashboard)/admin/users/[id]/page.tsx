import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Mail, Building2, Calendar, User, Shield, Edit, Trash2 } from 'lucide-react';
import { UserPermissionsManager } from './user-permissions-manager';

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
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

  // Get user details with tenant info
  const { data: userProfile, error: userError } = await supabase
    .from('profiles')
    .select(`
      *,
      tenants:tenant_id (
        id,
        name,
        slug
      )
    `)
    .eq('id', id)
    .single();

  if (userError || !userProfile) {
    notFound();
  }

  // Get analyses count for this user
  const { count: analysesCount } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', id);

  // Get all available modules (for permissions management)
  const { data: allModules } = await supabase
    .from('modules')
    .select('*')
    .order('name', { ascending: true });

  // Get user permissions (default to empty object if null)
  const userPermissions = (userProfile.permissions as any) || { modules: {} };

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
          <Link href={userProfile.tenant_id ? `/admin/tenants/${userProfile.tenant_id}` : '/admin/users'}>
            <Button variant="ghost" size="sm" className="transition-all hover:scale-105">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {userProfile.full_name || userProfile.email}
            </h1>
            <p className="text-muted-foreground mt-1.5">
              Détails de l'utilisateur
            </p>
          </div>
        </div>
        <Link href={`/admin/users/${id}/edit`}>
          <Button variant="outline" className="transition-all hover:scale-105">
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>

      {/* User Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{userProfile.email}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rôle</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="mt-2">
              {getRoleBadge(userProfile.role)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Analyses créées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Details */}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>
            Détails du profil utilisateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">Nom complet</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {userProfile.full_name || '-'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <span className="text-sm">{userProfile.email}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">Rôle</span>
              </div>
              {getRoleBadge(userProfile.role)}
            </div>

            {userProfile.tenant_id ? (
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">Tenant</span>
                </div>
                <Link href={`/admin/tenants/${userProfile.tenant_id}`}>
                  <Button variant="link" className="h-auto p-0 text-sm">
                    {(userProfile.tenants as any)?.name || '-'}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">Tenant</span>
                </div>
                <Badge variant="outline" className="text-xs">Super Admin (pas de tenant)</Badge>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">Date de création</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(userProfile.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Permissions */}
      {allModules && userProfile.tenant_id && (
        <UserPermissionsManager
          userId={id}
          modules={allModules}
          currentPermissions={userPermissions}
        />
      )}
    </div>
  );
}
