import { createSupabaseServer } from '@/lib/supabase/server';

export type CurrentMembership = { userId: string; agencyId: string; role: string };

/**
 * The signed-in user's active membership, for Server Components that render
 * differently by role. Returns null when signed out or without an active
 * membership. Server Actions use `getAuthContext()` instead.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('agency_memberships')
    .select('agency_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  return membership ? { userId: user.id, agencyId: membership.agency_id, role: membership.role } : null;
}
