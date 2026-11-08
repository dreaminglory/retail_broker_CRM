import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { Area } from './types';
import type { CreateAreaInput, UpdateAreaInput } from './validation';

/** Unique (agency_id, settlement_id, lower(name)): the name is taken in this settlement. */
function saveFailure(error: { code?: string; message: string }, what: string): DomainError {
  return error.code === '23505'
    ? new DomainError('areas.errors.duplicateName')
    : new DomainError('errors.saveFailed', `Failed to ${what} area: ${error.message}`);
}

export class AreaRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findBySettlement(agencyId: string, settlementId: string, activeOnly = false): Promise<Area[]> {
    let request = this.db
      .from('areas')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('settlement_id', settlementId);
    if (activeOnly) request = request.eq('is_active', true);

    const { data, error } = await request
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch areas: ${error.message}`);
    return (data ?? []) as Area[];
  }

  async findByIds(ids: string[], agencyId: string): Promise<Area[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from('areas').select('*').eq('agency_id', agencyId).in('id', ids);

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch areas: ${error.message}`);
    return (data ?? []) as Area[];
  }

  /** The agency's areas, active and inactive, in any of these settlements (property import). */
  async findBySettlements(agencyId: string, settlementIds: string[]): Promise<Area[]> {
    const areas: Area[] = [];
    // Ids go in the URL: 100 at a time keeps it short for a file with many villages.
    for (let i = 0; i < settlementIds.length; i += 100) {
      const { data, error } = await this.db
        .from('areas')
        .select('*')
        .eq('agency_id', agencyId)
        .in('settlement_id', settlementIds.slice(i, i + 100));

      if (error) throw new DomainError('errors.loadFailed', `Failed to fetch areas: ${error.message}`);
      areas.push(...((data ?? []) as Area[]));
    }
    return areas;
  }

  /** The settlement of every area, for the per-settlement counts. */
  async findSettlementIds(agencyId: string): Promise<string[]> {
    const { data, error } = await this.db.from('areas').select('settlement_id').eq('agency_id', agencyId);

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch areas: ${error.message}`);
    return (data ?? []).map((row) => row.settlement_id as string);
  }

  async create(agencyId: string, input: CreateAreaInput, sortOrder: number): Promise<Area> {
    const { data, error } = await this.db
      .from('areas')
      .insert({ agency_id: agencyId, settlement_id: input.settlement_id, name: input.name, sort_order: sortOrder })
      .select()
      .single();

    if (error) throw saveFailure(error, 'create');
    return data as Area;
  }

  async update(id: string, agencyId: string, input: UpdateAreaInput): Promise<Area> {
    const { data, error } = await this.db
      .from('areas')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new DomainError('errors.not_found');
      throw saveFailure(error, 'update');
    }
    return data as Area;
  }

  /** One update per row, like stages: an agency has a handful of areas per settlement. */
  async reorder(agencyId: string, areas: { id: string; sort_order: number }[]): Promise<void> {
    for (const { id, sort_order } of areas) {
      const { error } = await this.db.from('areas').update({ sort_order }).eq('id', id).eq('agency_id', agencyId);
      if (error) throw new DomainError('errors.saveFailed', `Failed to reorder area ${id}: ${error.message}`);
    }
  }
}
