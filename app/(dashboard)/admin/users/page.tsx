import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, User, ArrowRight, Building2 } from 'lucide-react';
import { UserFilter } from './user-filter';

interface UsersPageProps {
  searchParams: Promise<{ tenant?: string }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
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

  // Get all tenants for the filter
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .order('name', { ascending: true });

  // Get filter from search params
  const params = await searchParams;
  const tenantFilter = params.tenant;

  // Build query for users
  let usersQuery = supabase
    .from('profiles')
    .select(`
      *,
      tenants:tenant_id (
        id,
        name,
        slug
      )
    `);

  // Apply tenant filter if specified
  if (tenantFilter && tenantFilter !== 'all') {
    usersQuery = usersQuery.eq('tenant_id', tenantFilter);
  }

  const { data: users } = await usersQuery.order('created_at', { ascending: false });

  // Get last_sign_in_at for each user
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

  // Get last_sign_in_at for each user from auth.users
  // Use listUsers to avoid rate limiting (more efficient than multiple getUserById calls)
  let usersWithLastSignIn = users || [];
  if (users && users.length > 0) {
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
      usersWithLastSignIn = (users || []).map((user) => ({
        ...user,
        last_sign_in_at: authUsersMap.get(user.id) || null,
      }));
    } catch (error) {
      console.warn('Could not fetch auth users, using profile data only:', error);
      // Fallback: use profile data without last_sign_in_at
      usersWithLastSignIn = users || [];
    }
  }

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Liste des utilisateurs</CardTitle>
              <CardDescription>
                {usersWithLastSignIn?.length || 0} utilisateur{usersWithLastSignIn && usersWithLastSignIn.length > 1 ? 's' : ''} enregistré{usersWithLastSignIn && usersWithLastSignIn.length > 1 ? 's' : ''}
              </CardDescription>
            </div>
            {tenants && tenants.length > 0 && (
              <UserFilter tenants={tenants} currentTenant={tenantFilter} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {usersWithLastSignIn && usersWithLastSignIn.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Tenant</TableHead>
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
                      {userProfile.last_sign_in_at
                        ? new Date(userProfile.last_sign_in_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Jamais connecté'}
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
