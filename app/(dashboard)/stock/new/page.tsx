import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { NewAnalysisForm } from './new-analysis-form';
import { isModuleEnabledForTenant, hasModulePermission } from '@/lib/utils/modules';

export default async function NewAnalysisPage() {
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

  if (!profile) {
    redirect('/login');
  }

  // Check if Stock Health module is enabled for this tenant
  if (!profile.tenant_id) {
    redirect('/login');
  }

  const stockModuleEnabled = await isModuleEnabledForTenant(profile.tenant_id, 'stock');
  if (!stockModuleEnabled) {
    redirect('/dashboard');
  }

  // Check if user has write permission for Stock Health
  const hasWritePermission = await hasModulePermission(user.id, 'stock', 'write');
  if (!hasWritePermission) {
    redirect('/stock');
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nouvelle analyse</h1>
        <p className="text-muted-foreground mt-1">
          Créez une nouvelle analyse de stock en uploadant un fichier CSV ou Excel
        </p>
      </div>

      <NewAnalysisForm tenantId={profile.tenant_id} userId={user.id} />
    </div>
  );
}
