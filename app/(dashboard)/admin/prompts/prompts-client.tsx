'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FileText, Edit, Copy, Trash2, ChevronDown, ChevronUp, Globe, Building2 } from 'lucide-react';
import { getPromptTypeLabel, getPromptTypeDescription, PROMPT_TYPE_ORDER } from '@/lib/utils/prompt-types';

interface Tenant {
  id: string;
  name: string;
}

interface Prompt {
  id: string;
  tenant_id: string | null;
  module_code: string;
  prompt_type: string;
  title: string;
  content: string;
  version: number;
  is_active: boolean;
  tenants?: { id: string; name: string } | null;
}

interface PromptsClientProps {
  prompts: Prompt[];
  tenants: Tenant[];
}

export function PromptsClient({ prompts, tenants }: PromptsClientProps) {
  const router = useRouter();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  // Filter prompts based on selection
  const globalPrompts = prompts.filter((p) => p.tenant_id === null && p.is_active);
  const tenantPrompts = selectedTenantId
    ? prompts.filter((p) => p.tenant_id === selectedTenantId && p.is_active)
    : [];

  // Group by module and type
  const groupPrompts = (promptList: Prompt[]) => {
    const grouped: Record<string, Record<string, Prompt[]>> = {};
    promptList.forEach((prompt) => {
      const moduleCode = prompt.module_code || 'unknown';
      const promptType = prompt.prompt_type || 'unknown';
      if (!grouped[moduleCode]) grouped[moduleCode] = {};
      if (!grouped[moduleCode][promptType]) grouped[moduleCode][promptType] = [];
      grouped[moduleCode][promptType].push(prompt);
    });
    return grouped;
  };

  const getModuleLabel = (code: string) => {
    const labels: Record<string, string> = { stock: 'Stock Health' };
    return labels[code] || code;
  };

  const toggleRole = (promptId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  };

  const handleDuplicate = async (globalPrompt: Prompt) => {
    if (!selectedTenantId) return;
    setLoading(globalPrompt.id);
    try {
      const res = await fetch('/api/admin/prompts/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: globalPrompt.id, tenantId: selectedTenantId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la duplication');
      } else {
        router.refresh();
      }
    } catch (e) {
      alert('Erreur réseau');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (prompt: Prompt) => {
    if (!confirm('Supprimer ce prompt personnalisé ? Le tenant utilisera le prompt global.')) return;
    setLoading(prompt.id);
    try {
      const res = await fetch(`/api/admin/prompts/${prompt.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la suppression');
      } else {
        router.refresh();
      }
    } catch (e) {
      alert('Erreur réseau');
    } finally {
      setLoading(null);
    }
  };

  // For tenant view: merge global and tenant prompts
  const getTenantViewPrompts = () => {
    if (!selectedTenantId) return [];
    const tenantPromptMap = new Map<string, Prompt>();
    tenantPrompts.forEach((p) => {
      tenantPromptMap.set(`${p.module_code}:${p.prompt_type}`, p);
    });
    // Return all global prompts, marking which ones have tenant overrides
    return globalPrompts.map((gp) => {
      const key = `${gp.module_code}:${gp.prompt_type}`;
      const tenantOverride = tenantPromptMap.get(key);
      return { global: gp, tenant: tenantOverride || null };
    });
  };

  // Sort prompt types by PROMPT_TYPE_ORDER
  const sortedTypes = (types: Record<string, Prompt[]>) => {
    return Object.entries(types).sort(([a], [b]) => {
      const orderA = PROMPT_TYPE_ORDER.indexOf(a);
      const orderB = PROMPT_TYPE_ORDER.indexOf(b);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });
  };

  const renderPromptRow = (prompt: Prompt, isInherited: boolean = false, globalPrompt?: Prompt) => {
    const typeDescription = getPromptTypeDescription(prompt.prompt_type);
    const hasDescription = typeDescription.length > 0;
    const isExpanded = expandedRoles.has(prompt.id);
    const isLoading = loading === prompt.id || (globalPrompt && loading === globalPrompt.id);

    return (
      <div key={prompt.id} className={`rounded border p-3 ${isInherited ? 'bg-slate-50 border-dashed' : 'bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium">{prompt.title}</span>
              <Badge variant="outline" className="text-xs">v{prompt.version}</Badge>
              {isInherited ? (
                <Badge className="text-xs bg-slate-100 text-slate-600">
                  <Globe className="h-3 w-3 mr-1" />
                  Hérité du global
                </Badge>
              ) : prompt.tenant_id ? (
                <Badge className="text-xs bg-emerald-100 text-emerald-700">
                  <Building2 className="h-3 w-3 mr-1" />
                  Personnalisé
                </Badge>
              ) : (
                <Badge className="text-xs bg-blue-100 text-blue-700">
                  <Globe className="h-3 w-3 mr-1" />
                  Global
                </Badge>
              )}
              {hasDescription && (
                <button
                  type="button"
                  onClick={() => toggleRole(prompt.id)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {isExpanded ? 'Masquer le rôle' : 'Voir le rôle'}
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {prompt.content.substring(0, 150)}...
            </p>
            {hasDescription && isExpanded && (
              <div className="mt-3 rounded border border-blue-200 bg-blue-50/50 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-800 mb-1">{getPromptTypeLabel(prompt.prompt_type)}</p>
                <p>{typeDescription}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isInherited && selectedTenantId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(prompt)}
                disabled={isLoading}
              >
                <Copy className="mr-2 h-4 w-4" />
                {isLoading ? 'En cours...' : 'Personnaliser'}
              </Button>
            ) : prompt.tenant_id ? (
              <>
                <Link href={`/admin/prompts/${prompt.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(prompt)}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link href={`/admin/prompts/${prompt.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tenant Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sélectionner le contexte</CardTitle>
          <CardDescription>
            Choisissez "Global" pour voir/éditer les prompts par défaut, ou un tenant pour personnaliser ses prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant={selectedTenantId === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTenantId(null)}
            >
              <Globe className="mr-2 h-4 w-4" />
              Global (défaut)
            </Button>
            {tenants.map((tenant) => (
              <Button
                key={tenant.id}
                variant={selectedTenantId === tenant.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTenantId(tenant.id)}
              >
                <Building2 className="mr-2 h-4 w-4" />
                {tenant.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prompts List */}
      {selectedTenantId === null ? (
        // Global view
        <div className="space-y-6">
          {Object.entries(groupPrompts(globalPrompts)).map(([moduleCode, types]) => (
            <Card key={moduleCode}>
              <CardHeader>
                <CardTitle>{getModuleLabel(moduleCode)}</CardTitle>
                <CardDescription>Prompts globaux (utilisés par défaut pour tous les tenants)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedTypes(types).map(([promptType, promptList]) => (
                    <div key={promptType} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">{getPromptTypeLabel(promptType)}</h3>
                      </div>
                      <div className="space-y-2">
                        {promptList.map((prompt) => renderPromptRow(prompt))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Tenant view
        <div className="space-y-6">
          {Object.entries(groupPrompts(globalPrompts)).map(([moduleCode, types]) => {
            const tenantViewData = getTenantViewPrompts();
            const modulePrompts = tenantViewData.filter((p) => p.global.module_code === moduleCode);

            return (
              <Card key={moduleCode}>
                <CardHeader>
                  <CardTitle>{getModuleLabel(moduleCode)}</CardTitle>
                  <CardDescription>
                    Prompts pour le tenant "{tenants.find((t) => t.id === selectedTenantId)?.name}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sortedTypes(types).map(([promptType]) => {
                      const item = modulePrompts.find((p) => p.global.prompt_type === promptType);
                      if (!item) return null;
                      return (
                        <div key={promptType} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold">{getPromptTypeLabel(promptType)}</h3>
                          </div>
                          <div className="space-y-2">
                            {item.tenant
                              ? renderPromptRow(item.tenant)
                              : renderPromptRow(item.global, true, item.global)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
