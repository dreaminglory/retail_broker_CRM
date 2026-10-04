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
