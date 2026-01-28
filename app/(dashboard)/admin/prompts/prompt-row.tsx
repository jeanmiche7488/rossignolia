'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Edit, ChevronDown, ChevronUp } from 'lucide-react';

interface PromptRowProps {
  prompt: {
    id: string;
    title: string;
    content: string;
    version: number;
    tenant_id: string | null;
    tenants?: { name: string } | null;
  };
  typeLabel: string;
  typeDescription: string;
}

export function PromptRow({ prompt, typeLabel, typeDescription }: PromptRowProps) {
  const [showRole, setShowRole] = useState(false);
  const hasDescription = typeDescription.length > 0;

  return (
    <div className="rounded border bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium">{prompt.title}</span>
            <Badge variant="outline" className="text-xs">
              v{prompt.version}
            </Badge>
            {prompt.tenant_id ? (
              <Badge variant="secondary" className="text-xs">
                {prompt.tenants?.name || 'Tenant spécifique'}
              </Badge>
            ) : (
              <Badge className="text-xs bg-blue-100 text-blue-700">
                Global
              </Badge>
            )}
            {hasDescription && (
              <button
                type="button"
                onClick={() => setShowRole(!showRole)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                {showRole ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Masquer le rôle
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Voir le rôle
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {prompt.content.substring(0, 150)}...
          </p>
          {hasDescription && showRole && (
            <div className="mt-3 rounded border border-blue-200 bg-blue-50/50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-800 mb-1">{typeLabel}</p>
              <p>{typeDescription}</p>
            </div>
          )}
        </div>
        <Link href={`/admin/prompts/${prompt.id}/edit`} className="flex-shrink-0">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>
    </div>
  );
}
