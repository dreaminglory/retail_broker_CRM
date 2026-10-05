/**
 * Shared Server Action utilities.
 * Used by all action files to resolve auth context.
 */

import { createSupabaseServer } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Shared result type ────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ── Auth context ──────────────────────────────────────────────────────────────

export interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
  agencyId: string;
  role: string;
}

/**
 * Resolves and validates the current user's auth context.
 * Throws if the user is unauthenticated or has no active agency membership.
 * Call this at the top of every Server Action.
 */
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

// ── Error handling ────────────────────────────────────────────────────────────

import { DomainError } from '@/lib/errors';
import { getTranslations } from 'next-intl/server';

/**
 * Normalizes an unknown error into a localized action error result.
 * Supports DomainError which maps directly to i18n keys.
 */
export async function toActionError(error: unknown): Promise<{ success: false, error: string }> {
  const t = await getTranslations('Errors');

  if (error instanceof DomainError) {
    try {
      // Try to resolve the specific domain error code
      // We pass the params for interpolation
      const message = t(error.code as any, error.params);
      return { success: false, error: message || error.message };
    } catch {
      return { success: false, error: error.message };
    }
  }

  if (error instanceof Error) {
    // Basic mapping for common errors
    if (error.message === 'Unauthorized' || error.message === 'No active agency membership') {
      return { success: false, error: t('unauthorized') };
    }
    return { success: false, error: error.message };
  }

  return { success: false, error: t('default') };
}
