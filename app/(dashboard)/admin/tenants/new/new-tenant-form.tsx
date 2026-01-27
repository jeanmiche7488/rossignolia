'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function NewTenantForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSlugChange = (value: string) => {
    // Auto-generate slug from name
    const generatedSlug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with -
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
    
    setSlug(generatedSlug);
    setName(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom est requis');
      return;
    }

    if (!slug.trim()) {
      setError('Le slug est requis');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/create-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      router.push(`/admin/tenants/${data.tenantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nom du tenant *</Label>
        <Input
          id="name"
          placeholder="OGF"
          value={name}
          onChange={(e) => handleSlugChange(e.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Le nom de l'organisation
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          placeholder="ogf"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Identifiant unique (généré automatiquement depuis le nom)
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/admin/tenants">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            className="transition-all hover:scale-105"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Annuler
          </Button>
        </Link>
        <Button type="submit" disabled={loading || !name.trim() || !slug.trim()} className="transition-all hover:scale-105 hover:shadow-md">
          {loading ? 'Création...' : 'Créer le tenant'}
        </Button>
      </div>
    </form>
  );
}
