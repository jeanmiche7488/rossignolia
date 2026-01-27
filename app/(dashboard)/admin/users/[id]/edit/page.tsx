import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditUserForm } from './edit-user-form';

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: EditUserPageProps) {
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

  // Get all tenants for the select
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .order('name', { ascending: true });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Modifier l'utilisateur</h1>
        <p className="text-muted-foreground mt-1.5">
          Modifiez les informations de {userProfile.full_name || userProfile.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'utilisateur</CardTitle>
          <CardDescription>
            Modifiez les informations ci-dessous
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditUserForm user={userProfile} tenants={tenants || []} />
        </CardContent>
      </Card>
    </div>
  );
}
