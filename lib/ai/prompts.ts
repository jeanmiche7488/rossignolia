import { createClient } from '@supabase/supabase-js';
import type { PromptType } from './gemini';

export interface SystemPrompt {
  id: string;
  tenant_id: string | null;
  module_code: string;
  prompt_type: PromptType;
  title: string;
  content: string;
  config: Record<string, unknown>;
  version: number;
  is_active: boolean;
}

/**
 * Get system prompt from database
 * Priority: tenant-specific > global (tenant_id = NULL)
 */
export async function getSystemPrompt(
  tenantId: string | null,
  moduleCode: string,
  promptType: PromptType
): Promise<SystemPrompt | null> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Try to get tenant-specific prompt first
  if (tenantId) {
    const { data: tenantPrompt } = await supabaseAdmin
      .from('system_prompts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('module_code', moduleCode)
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (tenantPrompt) {
      return tenantPrompt as SystemPrompt;
    }
  }

  // Fallback to global prompt
  const { data: globalPrompt } = await supabaseAdmin
    .from('system_prompts')
    .select('*')
    .is('tenant_id', null)
    .eq('module_code', moduleCode)
    .eq('prompt_type', promptType)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  return globalPrompt as SystemPrompt | null;
}

/**
 * Replace placeholders in prompt template
 */
export function replacePromptPlaceholders(
  template: string,
  variables: Record<string, string | number | unknown[]>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    let replacement: string;
    
    if (Array.isArray(value)) {
      replacement = JSON.stringify(value, null, 2);
    } else if (typeof value === 'object' && value !== null) {
      replacement = JSON.stringify(value, null, 2);
    } else {
      replacement = String(value);
    }
    
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
  }
  
  return result;
}
