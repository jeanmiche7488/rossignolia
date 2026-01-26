import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewTenantForm } from './new-tenant-form';

export default async function NewTenantPage() {
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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nouveau tenant</h1>
        <p className="text-muted-foreground mt-1.5">
          Créez une nouvelle organisation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du tenant</CardTitle>
          <CardDescription>
            Remplissez les informations pour créer un nouveau tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewTenantForm />
        </CardContent>
      </Card>
    </div>
  );
}
