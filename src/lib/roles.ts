/**
 * Membership roles and role checks. Pure, so client components can use it too.
 */
import type { MemberRole } from '@/domain/members/types';

export type { MemberRole };

/** Roles that may change agency configuration: stages, lead sources, contact merge (AD-045). */
export const CONFIG_ROLES: readonly MemberRole[] = ['owner', 'manager'];

/** Roles that may see the whole agency's work on Today (AD-044). */
export const MANAGER_ROLES: readonly MemberRole[] = ['owner', 'manager'];

/** True when `role` is one of `roles`. A missing role (no membership) is never allowed. */
export function hasRole(role: string | null | undefined, roles: readonly MemberRole[]): boolean {
  return roles.some((allowed) => allowed === role);
}
