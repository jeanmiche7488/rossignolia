'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EditTenantFormProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

export function EditTenantForm({ tenant }: EditTenantFormProps) {
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
      const response = await fetch('/api/admin/update-tenant', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          name: name.trim(),
          slug: slug.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      router.push(`/admin/tenants/${tenant.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/delete-tenant?tenantId=${tenant.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      router.push('/admin/tenants');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setDeleteLoading(false);
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

      <div className="flex gap-4 justify-between">
        <div className="flex gap-4">
          <Link href={`/admin/tenants/${tenant.id}`}>
            <Button
              type="button"
              variant="outline"
              disabled={loading || deleteLoading}
              className="transition-all hover:scale-105"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={loading || deleteLoading || !name.trim() || !slug.trim()} className="transition-all hover:scale-105 hover:shadow-md">
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={loading || deleteLoading}
              className="transition-all hover:scale-105"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le tenant "{tenant.name}" et toutes ses données associées seront définitivement supprimés.
                {tenant.id && (
                  <span className="block mt-2 text-xs text-muted-foreground">
                    Tenant ID: {tenant.id}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteLoading ? 'Suppression...' : 'Supprimer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
