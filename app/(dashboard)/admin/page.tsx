import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Building2, Mail, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
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
    redirect('/stock');
  }

  // Get all tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  // Get all users count
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Get all analyses count
  const { count: totalAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true });

  // Get users per tenant
  const { data: usersPerTenant } = await supabase
    .from('profiles')
    .select('tenant_id')
    .then((result) => {
      if (result.data) {
        const counts: Record<string, number> = {};
        result.data.forEach((profile) => {
          if (profile.tenant_id) {
            counts[profile.tenant_id] = (counts[profile.tenant_id] || 0) + 1;
          }
        });
        return counts;
      }
      return {};
    });

  // Get recent users with tenant info and last_sign_in_at
  // Use service role client to access auth.users data
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select(`
      *,
      tenants:tenant_id (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get last_sign_in_at for each user from auth.users
  // Use listUsers to avoid rate limiting (more efficient than multiple getUserById calls)
  let usersWithLastSignIn = recentUsers || [];
  if (recentUsers && recentUsers.length > 0) {
    try {
      // Get all auth users in one call (limited to 1000, which should be enough)
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      
      // Create a map for quick lookup
      const authUsersMap = new Map(
        authUsers?.map((au) => [au.id, au.last_sign_in_at]) || []
      );
      
      // Merge with profile data
      usersWithLastSignIn = (recentUsers || []).map((user) => ({
        ...user,
        last_sign_in_at: authUsersMap.get(user.id) || null,
      }));
    } catch (error) {
      console.warn('Could not fetch auth users, using profile data only:', error);
      // Fallback: use profile data without last_sign_in_at
      usersWithLastSignIn = recentUsers || [];
    }
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des tenants et utilisateurs
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/tenants">
            <Button variant="outline" className="transition-all hover:scale-105">
              <Building2 className="mr-2 h-4 w-4" />
              Gérer les tenants
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" className="transition-all hover:scale-105">
              <Users className="mr-2 h-4 w-4" />
              Gérer les utilisateurs
            </Button>
          </Link>
          <Link href="/admin/prompts">
            <Button variant="outline" className="transition-all hover:scale-105">
              <Mail className="mr-2 h-4 w-4" />
              Prompts système
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tenants
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Organisations actives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisateurs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Utilisateurs total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnalyses || 0}</div>
            <p className="text-xs text-muted-foreground">
              Analyses totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilisateurs récents</CardTitle>
              <CardDescription>
                Derniers utilisateurs (par date de dernière connexion)
              </CardDescription>
            </div>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="transition-all hover:scale-105">
                Voir tout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {usersWithLastSignIn && usersWithLastSignIn.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithLastSignIn
                  .sort((a, b) => {
                    // Sort by last_sign_in_at (most recent first), then by created_at
                    const aDate = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
                    const bDate = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
                    if (bDate !== aDate) return bDate - aDate;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  })
                  .map((userProfile) => (
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
                      {userProfile.tenant_id ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span className="text-sm">
                            {(userProfile.tenants as any)?.name || '-'}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">Super Admin</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          userProfile.role === 'SUPER_ADMIN'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : userProfile.role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }
                      >
                        {userProfile.role === 'SUPER_ADMIN'
                          ? 'Super Admin'
                          : userProfile.role === 'ADMIN'
                          ? 'Admin'
                          : 'Utilisateur'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">
                          {userProfile.last_sign_in_at
                            ? new Date(userProfile.last_sign_in_at).toLocaleDateString('fr-FR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Jamais connecté'}
                        </span>
                      </div>
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
              <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
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
