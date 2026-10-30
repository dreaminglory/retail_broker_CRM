/**
 * Shared Server Action utilities.
 * Used by all action files to resolve auth context.
 */

import { createSupabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { getTranslations } from 'next-intl/server';
import { DomainError } from '@/lib/errors';
import { CONFIG_ROLES, hasRole, type MemberRole } from '@/lib/roles';

export { CONFIG_ROLES };

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
  agencyId: string;
  role: string;
}

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!membership) throw new Error('No active agency membership');

  return {
    supabase,
    userId: user.id,
    agencyId: membership.agency_id,
    role: membership.role,
  };
}

/**
 * Throws `DomainError('errors.forbidden')` unless the caller has one of `roles`.
 * RLS enforces the same rule; this refuses the action before any write.
 */
export function requireRole(ctx: Pick<AuthContext, 'role'>, roles: readonly MemberRole[]): void {
  if (!hasRole(ctx.role, roles)) throw new DomainError('errors.forbidden');
}

export async function toActionError(error: unknown, _t?: any): Promise<{ success: false, error: string, fieldErrors?: Record<string, string[]> }> {
  const t = await getTranslations();
  
  if (error instanceof ZodError) {
    // A validator without an i18n key carries Zod's default English message.
    const translate = (message: string) =>
      t.has(message as never) ? t(message as never) : t('validation.failed');
    const fieldErrors: Record<string, string[]> = {};
    for (const [path, messages] of Object.entries(error.flatten().fieldErrors)) {
      if (messages) {
        fieldErrors[path] = messages.map(translate);
      }
    }
    const formErrors = error.flatten().formErrors;
    const translatedFormErrors = formErrors.map(translate);

    return {
      success: false,
      error: translatedFormErrors.length > 0 ? translatedFormErrors[0] : t('validation.failed' as any),
      fieldErrors,
    };
  }

  if (error instanceof DomainError) {
    if (error.message !== error.code) console.error(error.message);
    try {
      const message = t(error.code as any, error.params);
      return { success: false, error: message || error.message };
    } catch {
      return { success: false, error: error.message };
    }
  }

  if (error instanceof Error) {
    if (error.message === 'Unauthorized' || error.message === 'No active agency membership') {
      return { success: false, error: t('errors.unauthorized' as any) };
    }
    console.error(error);
    return { success: false, error: t('errors.unexpected') };
  }

  return { success: false, error: t('errors.unexpected' as any) };
}