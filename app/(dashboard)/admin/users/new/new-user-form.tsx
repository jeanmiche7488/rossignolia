'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface NewUserFormProps {
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

// Generate a random password
function generatePassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export function NewUserForm({ tenants }: NewUserFormProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('L\'email est requis');
      return;
    }

    if (!tenantId) {
      setError('Le tenant est requis');
      return;
    }

    setLoading(true);

    // Generate password automatically
    const password = generatePassword();

    try {
      // Create user in Supabase Auth
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim() || undefined,
          tenantId,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      // Store generated password to show to admin
      setGeneratedPassword(password);
      
      // Show success message with password
      setTimeout(() => {
        router.push(`/admin/users/${data.userId}`);
      }, 2000);
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

      {generatedPassword && (
        <div className="rounded-lg border border-green-500/50 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-900">Utilisateur créé avec succès !</p>
          <div className="space-y-1">
            <p className="text-xs text-green-700">Mot de passe généré :</p>
            <div className="flex items-center gap-2">
              <code className="px-3 py-1.5 bg-white border border-green-200 rounded text-sm font-mono text-green-900">
                {generatedPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword);
                }}
                className="text-xs"
              >
                Copier
              </Button>
            </div>
            <p className="text-xs text-green-600 mt-2">⚠️ Notez ce mot de passe, il ne sera plus affiché.</p>
          </div>
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
        <Label htmlFor="tenant">Tenant *</Label>
        <Select
          id="tenant"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          disabled={loading}
          required
        >
          <option value="">Sélectionnez un tenant</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rôle *</Label>
        <Select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
          disabled={loading}
          required
        >
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Administrateur</option>
        </Select>
      </div>

      <div className="flex gap-4">
        <Link href="/admin/users">
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
        <Button type="submit" disabled={loading || !email.trim() || !tenantId || !!generatedPassword} className="transition-all hover:scale-105 hover:shadow-md">
          {loading ? 'Création...' : 'Créer l\'utilisateur'}
        </Button>
      </div>
    </form>
  );
}
