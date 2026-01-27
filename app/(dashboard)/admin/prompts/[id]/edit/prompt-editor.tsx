'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, AlertCircle } from 'lucide-react';

interface PromptEditorProps {
  prompt: any;
}

export function PromptEditor({ prompt }: PromptEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(prompt.title || '');
  const [content, setContent] = useState(prompt.content || '');
  const [isActive, setIsActive] = useState(prompt.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/prompts/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptId: prompt.id,
          title,
          content,
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
      }

      router.refresh();
      router.push('/admin/prompts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
      setSaving(false);
    }
  };

  const getPromptTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      mapping: 'Mapping',
      cleaning: 'Nettoyage',
      advisor: 'Analyse/Recommandations',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prompt Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du prompt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Module: {prompt.module_code}</Badge>
            <Badge variant="outline">Type: {getPromptTypeLabel(prompt.prompt_type)}</Badge>
            <Badge variant="outline">Version: {prompt.version}</Badge>
            {prompt.tenant_id ? (
              <Badge variant="secondary">
                Tenant: {prompt.tenants?.name || 'Spécifique'}
              </Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-700">Global</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Contenu du prompt</CardTitle>
          <CardDescription>
            Utilisez {'{variable}'} pour les placeholders qui seront remplacés dynamiquement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du prompt"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenu du prompt</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Contenu du prompt..."
              rows={20}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Variables disponibles selon le type de prompt: {'{columns}'}, {'{sampleData}'}, {'{context}'}, {'{data}'}, {'{mappedColumns}'}, {'{issues}'}, {'{stockEntries}'}, {'{analysisMetadata}'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Actif (ce prompt sera utilisé)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !title.trim() || !content.trim()}
          className="min-w-[150px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Sauvegarder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
