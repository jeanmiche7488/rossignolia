import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { NewAnalysisForm } from './new-analysis-form';

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
