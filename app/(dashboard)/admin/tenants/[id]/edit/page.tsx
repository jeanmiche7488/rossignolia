import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditTenantForm } from './edit-tenant-form';

interface EditTenantPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTenantPage({ params }: EditTenantPageProps) {
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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Modifier le tenant</h1>
        <p className="text-muted-foreground mt-1.5">
          Modifiez les informations du tenant {tenant.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du tenant</CardTitle>
          <CardDescription>
            Modifiez les informations ci-dessous
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditTenantForm tenant={tenant} />
        </CardContent>
      </Card>
    </div>
  );
}
