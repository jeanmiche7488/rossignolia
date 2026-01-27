'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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

interface EditUserFormProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    tenant_id: string | null;
    role: string;
  };
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export function EditUserForm({ user, tenants }: EditUserFormProps) {
  const [email, setEmail] = useState(user.email);
  const [fullName, setFullName] = useState(user.full_name || '');
  const [tenantId, setTenantId] = useState(user.tenant_id || '');
  const [role, setRole] = useState<'USER' | 'ADMIN' | 'SUPER_ADMIN'>(user.role as any);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('L\'email est requis');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/update-user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: email.trim(),
          fullName: fullName.trim() || null,
          tenantId: tenantId || null,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      router.push(`/admin/users/${user.id}`);
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
      const response = await fetch(`/api/admin/delete-user?userId=${user.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      // Redirect based on tenant
      if (user.tenant_id) {
        router.push(`/admin/tenants/${user.tenant_id}`);
      } else {
        router.push('/admin/users');
      }
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
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input
          id="fullName"
          placeholder="Jean Dupont"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tenant">Tenant</Label>
        <Select
          id="tenant"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          disabled={loading || role === 'SUPER_ADMIN'}
        >
          <option value="">Aucun (Super Admin)</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </Select>
        {role === 'SUPER_ADMIN' && (
          <p className="text-xs text-muted-foreground">
            Les Super Admins n'ont pas de tenant associé
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rôle *</Label>
        <Select
          id="role"
          value={role}
          onChange={(e) => {
            const newRole = e.target.value as 'USER' | 'ADMIN' | 'SUPER_ADMIN';
            setRole(newRole);
            if (newRole === 'SUPER_ADMIN') {
              setTenantId('');
            }
          }}
          disabled={loading}
          required
        >
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Administrateur</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </Select>
      </div>

      <div className="flex gap-4 justify-between">
        <div className="flex gap-4">
          <Link href={`/admin/users/${user.id}`}>
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
          <Button type="submit" disabled={loading || deleteLoading} className="transition-all hover:scale-105 hover:shadow-md">
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
                Cette action est irréversible. L'utilisateur "{user.full_name || user.email}" sera définitivement supprimé.
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
