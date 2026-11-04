import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { escapeLikePattern } from '@/domain/contacts/validation';
import type { SettlementRow } from './types';
import { settlementNameColumn } from './validation';

/** Settlements are global: no agency filter, RLS lets every signed-in user read them. */
export class SettlementRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** Name prefix search, towns before villages, at most `limit` rows. */
  async searchByPrefix(query: string, limit: number): Promise<SettlementRow[]> {
    const pattern = escapeLikePattern(query);
    if (!pattern) return [];
    const { data, error } = await this.db
      .from('settlements')
      .select('*')
      .ilike(settlementNameColumn(query), `${pattern}%`)
      .order('kind', { ascending: true })
      .order('name_bg', { ascending: true })
      .order('ekatte', { ascending: true })
      .limit(limit);

    if (error) throw new DomainError('errors.loadFailed', `Failed to search settlements: ${error.message}`);
    return (data ?? []) as SettlementRow[];
  }

  async findByIds(ids: string[]): Promise<SettlementRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from('settlements').select('*').in('id', ids);

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch settlements: ${error.message}`);
    return (data ?? []) as SettlementRow[];
  }
}
