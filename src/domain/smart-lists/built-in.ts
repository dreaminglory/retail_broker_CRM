/**
 * The built-in lists (spec: smart-lists, "Built-in lists"). This is the only place they are
 * defined; the SQL list functions evaluate them. Nothing is seeded or migrated per agency.
 */

import { hasRole, MANAGER_ROLES } from '@/lib/roles';
import type { BuiltInListId, InquiryListFilter, ListFilter, ListScope, OpportunityListFilter } from './types';

/** "No recent activity" for hot deals and for sellers and landlords (ASSUMPTION A2). */
export const HOT_NO_TOUCH_DAYS = 3;
export const SELLER_NO_TOUCH_DAYS = 14;

type BuiltInBase = {
  id: BuiltInListId;
  /** `agency-only`: lists without an owner, shown to owners and managers only (rule 1). */
  scope: 'mine' | 'agency-only';
  nameKey: `smartLists.builtIn.${string}`;
};

export type BuiltInList =
  | (BuiltInBase & { entity: 'opportunity'; filter: OpportunityListFilter })
  | (BuiltInBase & { entity: 'inquiry'; filter: InquiryListFilter });

export const BUILT_IN_LISTS: readonly BuiltInList[] = [
  {
    id: 'no-next-action',
    entity: 'opportunity',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.noNextAction',
    filter: { status: ['active'], next_action: 'none', sort: 'last_touch_asc' },
  },
  {
    id: 'overdue',
    entity: 'opportunity',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.overdue',
    filter: { status: ['active'], next_action: 'overdue', sort: 'next_action_asc' },
  },
  {
    id: 'due-today',
    entity: 'opportunity',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.dueToday',
    filter: { status: ['active'], next_action: 'today', sort: 'next_action_asc' },
  },
  {
    id: 'hot-no-touch',
    entity: 'opportunity',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.hotNoTouch',
    filter: { status: ['active'], temperature: ['hot'], no_touch_days: HOT_NO_TOUCH_DAYS, sort: 'last_touch_asc' },
  },
  {
    id: 'sellers-need-update',
    entity: 'opportunity',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.sellersNeedUpdate',
    filter: {
      status: ['active'],
      type: ['seller', 'landlord'],
      no_touch_days: SELLER_NO_TOUCH_DAYS,
      sort: 'last_touch_asc',
    },
  },
  {
    // Oldest last touch first; each row shows its new-match count (founder, Checkpoint 1).
    id: 'new-matches',
    entity: 'opportunity',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.newMatches',
    filter: { status: ['active', 'nurture'], type: ['buyer', 'tenant'], has_new_matches: true, sort: 'last_touch_asc' },
  },
  {
    id: 'unassigned-deals',
    entity: 'opportunity',
    scope: 'agency-only',
    nameKey: 'smartLists.builtIn.unassignedDeals',
    filter: { status: ['active'], assigned_to: 'unassigned', sort: 'created_desc' },
  },
  {
    id: 'new-inquiries',
    entity: 'inquiry',
    scope: 'mine',
    nameKey: 'smartLists.builtIn.newInquiries',
    filter: { status: ['new'], sort: 'received_asc' },
  },
  {
    id: 'unassigned-inquiries',
    entity: 'inquiry',
    scope: 'agency-only',
    nameKey: 'smartLists.builtIn.unassignedInquiries',
    filter: { status: ['new'], assigned_to: 'unassigned', sort: 'received_asc' },
  },
];

export function isBuiltInListId(id: string): id is BuiltInListId {
  return BUILT_IN_LISTS.some((l) => l.id === id);
}

export function findBuiltInList(id: string): BuiltInList | undefined {
  return BUILT_IN_LISTS.find((l) => l.id === id);
}

/** Owners and managers get the Mine / Agency toggle; a broker always sees their own (AD-044). */
export function canSwitchListScope(role: string): boolean {
  return hasRole(role, MANAGER_ROLES);
}

export function resolveListScope(role: string, requested: string | undefined): ListScope {
  return requested === 'agency' && canSwitchListScope(role) ? 'agency' : 'mine';
}

/** The built-in lists a role may see: the agency-only ones for owners and managers only. */
export function visibleBuiltInLists(role: string): BuiltInList[] {
  return BUILT_IN_LISTS.filter((l) => l.scope === 'mine' || canSwitchListScope(role));
}

/** A built-in list's filter for a scope: Mine adds `assigned_to: 'me'`; agency-only lists don't move. */
export function scopedFilter(list: BuiltInList, scope: ListScope): ListFilter {
  const assigned = list.scope === 'mine' && scope === 'mine' ? { assigned_to: 'me' as const } : {};
  return list.entity === 'opportunity'
    ? { entity: 'opportunity', filter: { ...list.filter, ...assigned } }
    : { entity: 'inquiry', filter: { ...list.filter, ...assigned } };
}
