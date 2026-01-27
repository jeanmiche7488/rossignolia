'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Package, TrendingUp, Truck, Shield, Eye, Edit as EditIcon } from 'lucide-react';

interface Module {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface UserPermissionsManagerProps {
  userId: string;
  modules: Module[];
  currentPermissions: {
    modules?: {
      [moduleCode: string]: {
        read?: boolean;
        write?: boolean;
      };
    };
  };
}

const moduleIcons: Record<string, any> = {
  stock: Package,
  'demand-planning': TrendingUp,
  transport: Truck,
  'supplier-risk': Shield,
};

export function UserPermissionsManager({ userId, modules, currentPermissions }: UserPermissionsManagerProps) {
  const [permissions, setPermissions] = useState<{
    modules: { [key: string]: { read: boolean; write: boolean } };
  }>({
    modules: currentPermissions.modules || {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize permissions for all modules
  useEffect(() => {
    const initialized: { [key: string]: { read: boolean; write: boolean } } = {};
    modules.forEach((module) => {
      initialized[module.code] = currentPermissions.modules?.[module.code] || {
        read: true, // Default: read access
        write: false, // Default: no write access
      };
    });
    setPermissions({ modules: initialized });
  }, [modules, currentPermissions]);

  const updatePermission = (moduleCode: string, type: 'read' | 'write', value: boolean) => {
    setPermissions((prev) => ({
      modules: {
        ...prev.modules,
        [moduleCode]: {
          ...prev.modules[moduleCode],
          [type]: value,
          // If write is enabled, read must also be enabled
          ...(type === 'write' && value ? { read: true } : {}),
        },
      },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/update-user-permissions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          permissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  const hasChanges = () => {
    const current = currentPermissions.modules || {};
    const newPerms = permissions.modules;

    if (Object.keys(current).length !== Object.keys(newPerms).length) return true;

    for (const moduleCode in newPerms) {
      const currentPerm = current[moduleCode] || { read: true, write: false };
      const newPerm = newPerms[moduleCode];
      if (
        currentPerm.read !== newPerm.read ||
        currentPerm.write !== newPerm.write
      ) {
        return true;
      }
    }
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions par module</CardTitle>
        <CardDescription>
          Gérez les droits de lecture et d'écriture pour chaque use case
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-500/50 bg-green-50 p-4 text-sm text-green-900">
            Permissions mises à jour avec succès !
          </div>
        )}

        <div className="space-y-4">
          {modules.map((module) => {
            const Icon = moduleIcons[module.code] || Package;
            const modulePerms = permissions.modules[module.code] || { read: true, write: false };

            return (
              <div
                key={module.id}
                className="p-4 border-2 rounded-lg border-slate-200 bg-white"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-medium text-sm">{module.name}</h3>
                      {module.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {module.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`${module.code}-read`}
                          checked={modulePerms.read}
                          onChange={(e) => updatePermission(module.code, 'read', e.target.checked)}
                          disabled={loading}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label
                          htmlFor={`${module.code}-read`}
                          className="flex items-center gap-1.5 text-sm font-normal cursor-pointer"
                        >
                          <Eye className="h-4 w-4 text-slate-500" />
                          Lecture
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`${module.code}-write`}
                          checked={modulePerms.write}
                          onChange={(e) => updatePermission(module.code, 'write', e.target.checked)}
                          disabled={loading || !modulePerms.read}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <Label
                          htmlFor={`${module.code}-write`}
                          className="flex items-center gap-1.5 text-sm font-normal cursor-pointer"
                        >
                          <EditIcon className="h-4 w-4 text-slate-500" />
                          Écriture
                        </Label>
                      </div>
                      {modulePerms.write && (
                        <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">
                          Accès complet
                        </Badge>
                      )}
                      {modulePerms.read && !modulePerms.write && (
                        <Badge variant="outline" className="text-xs">
                          Lecture seule
                        </Badge>
                      )}
                      {!modulePerms.read && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs">
                          Aucun accès
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {hasChanges() && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={loading} className="transition-all hover:scale-105">
              {loading ? 'Enregistrement...' : 'Enregistrer les permissions'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
