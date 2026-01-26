import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewUserForm } from './new-user-form';

export default async function NewUserPage() {
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

  // Get all tenants for the select
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nouvel utilisateur</h1>
        <p className="text-muted-foreground mt-1.5">
          Créez un nouvel utilisateur pour un tenant
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'utilisateur</CardTitle>
          <CardDescription>
            Remplissez les informations pour créer un nouvel utilisateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewUserForm tenants={tenants || []} />
        </CardContent>
      </Card>
    </div>
  );
}
