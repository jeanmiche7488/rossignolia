import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { getPromptTypeLabel, getPromptTypeDescription } from '@/lib/utils/prompt-types';
import { PromptRow } from './prompt-row';

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

  // Group prompts by module and type
  const promptsByModule: Record<string, Record<string, any[]>> = {};
  if (prompts) {
    prompts.forEach((prompt: any) => {
      const moduleCode = prompt.module_code || 'unknown';
      const promptType = prompt.prompt_type || 'unknown';
      
      if (!promptsByModule[moduleCode]) {
        promptsByModule[moduleCode] = {};
      }
      if (!promptsByModule[moduleCode][promptType]) {
        promptsByModule[moduleCode][promptType] = [];
      }
      promptsByModule[moduleCode][promptType].push(prompt);
    });
  }

  const getModuleLabel = (code: string) => {
    const labels: Record<string, string> = {
      stock: 'Stock Health',
    };
    return labels[code] || code;
  };

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
              Gestion des prompts utilisés par l'IA pour le mapping, le nettoyage et l'analyse
            </p>
          </div>
        </div>
      </div>

      {/* Prompts List */}
      {Object.keys(promptsByModule).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(promptsByModule).map(([moduleCode, types]) => (
            <Card key={moduleCode}>
              <CardHeader>
                <CardTitle>{getModuleLabel(moduleCode)}</CardTitle>
                <CardDescription>
                  Prompts pour le module {moduleCode}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(types).map(([promptType, promptList]) => (
                    <div key={promptType} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{getPromptTypeLabel(promptType)}</h3>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {promptList
                          .filter((p: any) => p.is_active)
                          .map((prompt: any) => (
                            <PromptRow
                              key={prompt.id}
                              prompt={prompt}
                              typeLabel={getPromptTypeLabel(prompt.prompt_type)}
                              typeDescription={getPromptTypeDescription(prompt.prompt_type)}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
