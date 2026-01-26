import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, User, ArrowRight, Building2 } from 'lucide-react';

export default async function UsersPage() {
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

  // Get all users with their tenant info
  const { data: users } = await supabase
    .from('profiles')
    .select(`
      *,
      tenants:tenant_id (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1.5">
            Gérez tous les utilisateurs de la plateforme
          </p>
        </div>
        <Link href="/admin/users/new">
          <Button className="transition-all hover:scale-105 hover:shadow-md">
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>
            {users?.length || 0} utilisateur{users && users.length > 1 ? 's' : ''} enregistré{users && users.length > 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userProfile) => (
                  <TableRow key={userProfile.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">
                      {userProfile.full_name || '-'}
                    </TableCell>
                    <TableCell>{userProfile.email}</TableCell>
                    <TableCell>
                      {getRoleBadge(userProfile.role)}
                    </TableCell>
                    <TableCell>
                      {userProfile.tenant_id ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span className="text-sm">
                            {(userProfile.tenants as any)?.name || '-'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(userProfile.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/users/${userProfile.id}`}>
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
              <User className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-muted-foreground mb-4">
                Aucun utilisateur pour le moment
              </p>
              <Link href="/admin/users/new">
                <Button className="transition-all hover:scale-105 hover:shadow-md">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer le premier utilisateur
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
