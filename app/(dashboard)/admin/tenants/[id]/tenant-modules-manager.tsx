'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, Truck, Shield, Check, X } from 'lucide-react';

interface Module {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface TenantModule {
  module_id: string;
  enabled: boolean;
  module: Module;
}

interface TenantModulesManagerProps {
  tenantId: string;
  modules: Module[];
  tenantModules: TenantModule[];
}

const moduleIcons: Record<string, any> = {
  stock: Package,
  'demand-planning': TrendingUp,
  transport: Truck,
  'supplier-risk': Shield,
};

export function TenantModulesManager({ tenantId, modules, tenantModules }: TenantModulesManagerProps) {
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Initialize enabled modules from tenant_modules
    const enabled = new Set<string>();
    tenantModules.forEach((tm) => {
      if (tm.enabled) {
        enabled.add(tm.module.code);
      }
    });
    setEnabledModules(enabled);
  }, [tenantModules]);

  const toggleModule = (moduleCode: string) => {
    const newEnabled = new Set(enabledModules);
    if (newEnabled.has(moduleCode)) {
      newEnabled.delete(moduleCode);
    } else {
      newEnabled.add(moduleCode);
    }
    setEnabledModules(newEnabled);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/admin/update-tenant-modules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          moduleCodes: Array.from(enabledModules),
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
    const currentEnabled = new Set<string>();
    tenantModules.forEach((tm) => {
      if (tm.enabled) {
        currentEnabled.add(tm.module.code);
      }
    });
    
    if (currentEnabled.size !== enabledModules.size) return true;
    for (const code of enabledModules) {
      if (!currentEnabled.has(code)) return true;
    }
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modules activés</CardTitle>
        <CardDescription>
          Gérez les use cases disponibles pour ce tenant
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
            Modules mis à jour avec succès !
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => {
            const Icon = moduleIcons[module.code] || Package;
            const isEnabled = enabledModules.has(module.code);

            return (
              <div
                key={module.id}
                className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isEnabled
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
                onClick={() => toggleModule(module.code)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`p-2 rounded-lg ${
                        isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{module.name}</h3>
                      {module.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {module.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ml-2">
                    {isEnabled ? (
                      <Badge className="bg-green-100 text-green-700 border border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-600">
                        <X className="h-3 w-3 mr-1" />
                        Inactif
                      </Badge>
                    )}
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
              {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
