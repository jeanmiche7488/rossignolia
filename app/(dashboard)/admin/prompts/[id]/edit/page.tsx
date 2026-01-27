import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { PromptEditor } from './prompt-editor';

interface EditPromptPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPromptPage({ params }: EditPromptPageProps) {
  const { id } = await params;
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

  // Get prompt
  const { data: prompt } = await supabase
    .from('system_prompts')
    .select(`
      *,
      tenants:tenant_id (
        id,
        name
      )
    `)
    .eq('id', id)
    .single();

  if (!prompt) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/prompts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Modifier le prompt</h1>
            <p className="text-muted-foreground mt-1">
              {prompt.title}
            </p>
          </div>
        </div>
      </div>

      <PromptEditor prompt={prompt} />
    </div>
  );
}
