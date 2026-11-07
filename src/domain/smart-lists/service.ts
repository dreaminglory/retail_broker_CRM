/**
 * Smart list service (spec: smart-lists, AD-062): the overview with counts, a list's pages and
 * the queue's next row. The lists are evaluated only by the SQL functions; this decides which
 * lists a viewer sees and on which scope (rule 1).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { ProfileRepository } from '../profiles/repository';
import {
  canSwitchListScope,
  findBuiltInList,
  resolveListScope,
  scopedFilter,
  visibleBuiltInLists,
  type BuiltInList,
} from './built-in';
import { SmartListRepository, type CountRequest } from './repository';
import type { ListFilter, ListRows, ListScope, SmartList, SmartListEntity, SortKey } from './types';
import {
  inquiryListFilterSchema,
  listNameSchema,
  opportunityListFilterSchema,
  parseStoredFilter,
} from './validation';

export type Viewer = { userId: string; agencyId: string; role: string };

export const LIST_PAGE_SIZE = 20;
/** Saved lists per member (rule 3; the SQL trigger is the guarantee). */
export const MAX_LISTS_PER_MEMBER = 50;
/** Saved opportunity lists with `has_new_matches` per member (rule 3, A6). */
export const MAX_MATCH_LISTS_PER_MEMBER = 5;
/** `smart_list_counts` takes at most 100 lists per call. */
const COUNTS_CHUNK = 100;

export type SavedListEntry = {
  list: SmartList;
  /** Null when the stored filter no longer parses (rule 5). */
  count: number | null;
  /** The creator's name, for a list someone else shared. */
  sharedBy: string | null;
};

export type ListOverview = {
  scope: ListScope;
  canSwitchScope: boolean;
  builtIn: { list: BuiltInList; count: number }[];
  saved: SavedListEntry[];
};

/** A list a viewer may open, with the filter it runs on this scope. */
export type ResolvedList =
  | { kind: 'built-in'; id: string; entity: SmartListEntity; list: BuiltInList; filter: ListFilter }
  | { kind: 'saved'; id: string; entity: SmartListEntity; list: SmartList; filter: ListFilter | null };

export type ListPage = {
  list: ResolvedList;
  scope: ListScope;
  page: number;
  pageSize: number;
  /** Null for a saved list whose filter no longer parses (rule 5). */
  result: ListRows | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SmartListService {
  private readonly repo: SmartListRepository;
  private readonly profiles: ProfileRepository;

  constructor(db: SupabaseClient) {
    this.repo = new SmartListRepository(db);
    this.profiles = new ProfileRepository(db);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Every list the viewer sees with its live count, in one counts call per 100 lists. */
  async overview(viewer: Viewer, requestedScope?: string): Promise<ListOverview> {
    const scope = resolveListScope(viewer.role, requestedScope);
    const builtIns = visibleBuiltInLists(viewer.role);
    const saved = await this.repo.findVisible(viewer.agencyId);

    const requests: CountRequest[] = builtIns.map((list) => {
      const { entity, filter } = scopedFilter(list, scope);
      return { key: list.id, entity, filter };
    });
    const parsedSaved = saved.map((list) => ({ list, parsed: parseStoredFilter(list.entity, list.filter) }));
    for (const { list, parsed } of parsedSaved) {
      if (parsed.ok) requests.push({ key: list.id, entity: parsed.filter.entity, filter: parsed.filter.filter });
    }

    const counts = new Map<string, number>();
    for (let i = 0; i < requests.length; i += COUNTS_CHUNK) {
      const chunk = await this.repo.counts(requests.slice(i, i + COUNTS_CHUNK));
      for (const [key, count] of chunk) counts.set(key, count);
    }

    const sharers = await this.profiles.getProfilesByIds(
      [...new Set(saved.filter((l) => l.shared && l.created_by !== viewer.userId).map((l) => l.created_by))]
    );

    return {
      scope,
      canSwitchScope: canSwitchListScope(viewer.role),
      builtIn: builtIns.map((list) => ({ list, count: counts.get(list.id) ?? 0 })),
      saved: parsedSaved.map(({ list, parsed }) => ({
        list,
        count: parsed.ok ? counts.get(list.id) ?? 0 : null,
        sharedBy: list.shared && list.created_by !== viewer.userId
          ? sharers.get(list.created_by)?.display_name ?? null
          : null,
      })),
    };
  }

  /**
   * A built-in id or a saved list's id, as this viewer may open it; null when unknown, not
   * visible (RLS) or agency-only for a broker.
   */
  async resolve(viewer: Viewer, listId: string, scope: ListScope): Promise<ResolvedList | null> {
    const builtIn = findBuiltInList(listId);
    if (builtIn) {
      if (!visibleBuiltInLists(viewer.role).includes(builtIn)) return null;
      return { kind: 'built-in', id: builtIn.id, entity: builtIn.entity, list: builtIn, filter: scopedFilter(builtIn, scope) };
    }
    if (!UUID_RE.test(listId)) return null;
    const saved = await this.repo.findById(viewer.agencyId, listId);
    if (!saved) return null;
    const parsed = parseStoredFilter(saved.entity, saved.filter);
    return { kind: 'saved', id: saved.id, entity: saved.entity, list: saved, filter: parsed.ok ? parsed.filter : null };
  }

  /** One page (1-based, 20 rows) of a list; null when the viewer can't open it. */
  async page(viewer: Viewer, listId: string, requestedScope: string | undefined, page = 1): Promise<ListPage | null> {
    const scope = resolveListScope(viewer.role, requestedScope);
    const list = await this.resolve(viewer, listId, scope);
    if (!list) return null;
    const current = Number.isInteger(page) && page >= 1 ? page : 1;
    const result = list.filter
      ? await this.repo.listRows(list.filter, { limit: LIST_PAGE_SIZE, offset: (current - 1) * LIST_PAGE_SIZE })
      : null;
    return { list, scope, page: current, pageSize: LIST_PAGE_SIZE, result };
  }

  /**
   * The queue's next row: the first one after `after` in the list's order, re-running the list
   * now, so a row that no longer fits has dropped off (rule 7). `after` null gives the first row.
   * `nextId` null means the list is done.
   */
  async next(
    viewer: Viewer,
    listId: string,
    requestedScope: string | undefined,
    after: SortKey | null
  ): Promise<{ nextId: string | null; total: number } | null> {
    const scope = resolveListScope(viewer.role, requestedScope);
    const list = await this.resolve(viewer, listId, scope);
    if (!list?.filter) return null;
    const { rows, total } = await this.repo.listRows(list.filter, { limit: 1, after });
    return { nextId: rows[0]?.id ?? null, total };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Saves a personal list. The caps are checked first for the friendly message (rule 3). */
  async save(
    viewer: Viewer,
    input: { name: string; entity: SmartListEntity; filter: unknown }
  ): Promise<SmartList> {
    const name = listNameSchema.parse(input.name);
    let filter: Record<string, unknown>;
    if (input.entity === 'opportunity') filter = opportunityListFilterSchema.parse(input.filter);
    else if (input.entity === 'inquiry') filter = inquiryListFilterSchema.parse(input.filter);
    else throw new DomainError('smartLists.errors.invalidEntity');

    const mine = await this.repo.countByMember(viewer.agencyId, viewer.userId);
    if (mine.total >= MAX_LISTS_PER_MEMBER) throw new DomainError('smartLists.errors.limit');
    if (input.entity === 'opportunity' && filter.has_new_matches === true && mine.matchLists >= MAX_MATCH_LISTS_PER_MEMBER) {
      throw new DomainError('smartLists.errors.matchListLimit');
    }

    return this.repo.insert(viewer.agencyId, viewer.userId, { name, entity: input.entity, filter, shared: false });
  }
}
