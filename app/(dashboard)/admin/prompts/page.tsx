import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PromptsClient } from './prompts-client';

export default async function PromptsPage() {
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

  // Get all system prompts (global and tenant-specific)
  const { data: prompts } = await supabase
    .from('system_prompts')
    .select(`
      *,
      tenants:tenant_id (
        id,
        name
      )
    `)
    .order('module_code', { ascending: true })
    .order('prompt_type', { ascending: true })
    .order('version', { ascending: false });

  // Get all tenants
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name')
    .order('name', { ascending: true });

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Prompts système</h1>
            <p className="text-muted-foreground mt-1">
              Gestion des prompts utilisés par l'IA — globaux (par défaut) ou personnalisés par tenant
            </p>
          </div>
        </div>
      </div>

      {/* Prompts List */}
      {prompts && prompts.length > 0 ? (
        <PromptsClient prompts={prompts} tenants={tenants || []} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucun prompt système configuré. Exécutez la migration SQL pour initialiser les prompts.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
