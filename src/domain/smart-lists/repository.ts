/**
 * Smart list repository: the SQL list functions and the `smart_lists` table (AD-062).
 * The functions are SECURITY INVOKER with their own agency filter; table reads filter by
 * agency here too (RLS is the safety net).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type {
  InquiryListRow,
  ListFilter,
  ListRows,
  OpportunityListRow,
  SmartList,
  SmartListEntity,
  SortKey,
} from './types';

/** An item of the counts call: the overview asks for every list at once. */
export type CountRequest = { key: string; entity: SmartListEntity; filter: Record<string, unknown> };

export type NewSmartList = { name: string; entity: SmartListEntity; filter: Record<string, unknown>; shared: boolean };

const SMART_LIST_COLUMNS = 'id, agency_id, created_by, name, entity, filter, shared, created_at, updated_at';

/** The i18n keys the SQL raises on purpose (P0001 `smartLists.errors.*`), else `fallback`. */
function sqlFailure(error: { code?: string; message: string }, fallback: string): DomainError {
  if (error.code === 'P0001' && error.message.startsWith('smartLists.errors.')) return new DomainError(error.message);
  if (error.code === '23505') return new DomainError('smartLists.errors.duplicateName');
  return new DomainError(fallback, error.message);
}

type RowWithTotal = { total_count: number | string };

type ListRowsOptions = { limit: number; offset?: number; after?: SortKey | null };

export class SmartListRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** One page of a list (or the row after `after`, for the queue), with the list's total. */
  async listRows(
    list: Extract<ListFilter, { entity: 'opportunity' }>,
    opts: ListRowsOptions
  ): Promise<Extract<ListRows, { entity: 'opportunity' }>>;
  async listRows(
    list: Extract<ListFilter, { entity: 'inquiry' }>,
    opts: ListRowsOptions
  ): Promise<Extract<ListRows, { entity: 'inquiry' }>>;
  async listRows(list: ListFilter, opts: ListRowsOptions): Promise<ListRows>;
  async listRows(list: ListFilter, opts: ListRowsOptions): Promise<ListRows> {
    const fn = list.entity === 'opportunity' ? 'smart_list_opportunities' : 'smart_list_inquiries';
    const { data, error } = await this.db.rpc(fn, {
      p_filter: list.filter,
      p_limit: opts.limit,
      p_offset: opts.offset ?? 0,
      p_after: opts.after ?? null,
    });
    if (error) throw sqlFailure(error, 'errors.loadFailed');

    const rows = (data ?? []) as RowWithTotal[];
    // total_count is the list's size before paging and before `after`; every row carries it.
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    return list.entity === 'opportunity'
      ? { entity: 'opportunity', rows: rows as unknown as OpportunityListRow[], total }
      : { entity: 'inquiry', rows: rows as unknown as InquiryListRow[], total };
  }

  /** Counts for up to 100 lists in one call, each capped at 1000 by the SQL. */
  async counts(items: CountRequest[]): Promise<Map<string, number>> {
    if (items.length === 0) return new Map();
    const { data, error } = await this.db.rpc('smart_list_counts', { p_lists: items });
    if (error) throw sqlFailure(error, 'errors.loadFailed');
    return new Map(((data ?? []) as { key: string; count: number }[]).map((r) => [r.key, r.count]));
  }

  /** The saved lists the caller sees: their own and the agency's shared ones (RLS). */
  async findVisible(agencyId: string): Promise<SmartList[]> {
    const { data, error } = await this.db
      .from('smart_lists')
      .select(SMART_LIST_COLUMNS)
      .eq('agency_id', agencyId)
      .order('name', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new DomainError('errors.loadFailed', `Failed to load smart lists: ${error.message}`);
    return (data ?? []) as SmartList[];
  }

  async findById(agencyId: string, id: string): Promise<SmartList | null> {
    const { data, error } = await this.db
      .from('smart_lists')
      .select(SMART_LIST_COLUMNS)
      .eq('agency_id', agencyId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new DomainError('errors.loadFailed', `Failed to load smart list: ${error.message}`);
    return (data as SmartList | null) ?? null;
  }

  /** How many lists the member saved, and how many of them are new-matches opportunity lists. */
  async countByMember(agencyId: string, userId: string): Promise<{ total: number; matchLists: number }> {
    const base = () =>
      this.db
        .from('smart_lists')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('created_by', userId);
    const [all, matches] = await Promise.all([
      base(),
      base().eq('entity', 'opportunity').contains('filter', { has_new_matches: true }),
    ]);
    const error = all.error ?? matches.error;
    if (error) throw new DomainError('errors.loadFailed', `Failed to count smart lists: ${error.message}`);
    return { total: all.count ?? 0, matchLists: matches.count ?? 0 };
  }

  async insert(agencyId: string, userId: string, input: NewSmartList): Promise<SmartList> {
    const { data, error } = await this.db
      .from('smart_lists')
      .insert({ agency_id: agencyId, created_by: userId, ...input })
      .select(SMART_LIST_COLUMNS)
      .single();
    if (error) throw sqlFailure(error, 'errors.saveFailed');
    return data as SmartList;
  }

  /** No row back means RLS hid it or refused the change. */
  async update(
    agencyId: string,
    id: string,
    patch: Partial<Pick<SmartList, 'name' | 'shared'>> & { filter?: Record<string, unknown> }
  ): Promise<SmartList> {
    const { data, error } = await this.db
      .from('smart_lists')
      .update(patch)
      .eq('agency_id', agencyId)
      .eq('id', id)
      .select(SMART_LIST_COLUMNS)
      .maybeSingle();
    if (error) throw sqlFailure(error, 'errors.saveFailed');
    if (!data) throw new DomainError('smartLists.errors.notFound');
    return data as SmartList;
  }

  async remove(agencyId: string, id: string): Promise<void> {
    const { data, error } = await this.db
      .from('smart_lists')
      .delete()
      .eq('agency_id', agencyId)
      .eq('id', id)
      .select('id');
    if (error) throw new DomainError('errors.deleteFailed', `Failed to delete smart list: ${error.message}`);
    if (!data || data.length === 0) throw new DomainError('smartLists.errors.notFound');
  }
}
