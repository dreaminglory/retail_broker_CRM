import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { RequirementRow } from './types';

export type RequirementLocationRow = { settlement_id: string; area_id: string | null };

export type RequirementWithLocationRows = RequirementRow & { locations: RequirementLocationRow[] };

const NUMERIC_FIELDS = ['budget_min', 'budget_max', 'area_m2_min', 'area_m2_max'] as const;

/** PostgREST may send a `numeric` as a string; the domain reads numbers. */
function toRow(data: RequirementWithLocationRows): RequirementWithLocationRows {
  const row = { ...data, locations: data.locations ?? [] };
  for (const field of NUMERIC_FIELDS) {
    const value = row[field] as number | string | null;
    row[field] = value === null ? null : Number(value);
  }
  return row;
}

/**
 * A refused RPC as a DomainError: the `requirements.errors.*` key it raised (AD-032, AD-059),
 * else `errors.saveFailed` with the database message as the log-only detail.
 */
export function requirementWriteFailure(error: { code?: string; message: string }): DomainError {
  if (error.code === 'P0001' && /^requirements\.errors\.\w+$/.test(error.message)) return new DomainError(error.message);
  return new DomainError('errors.saveFailed', `Failed to save requirement: ${error.message}`);
}

/**
 * Members can't write either table (AD-059): every write is one of the two RPCs, which check
 * the agency, the deal type and status themselves.
 */
export class RequirementRepository {
  constructor(private readonly db: SupabaseClient) {}

  /** The opportunity's requirement with its location ids, or null when it has none. */
  async findByOpportunity(opportunityId: string, agencyId: string): Promise<RequirementWithLocationRows | null> {
    const { data, error } = await this.db
      .from('requirements')
      .select('*, locations:requirement_locations!fk_requirement_locations_requirement(settlement_id, area_id)')
      .eq('agency_id', agencyId)
      .eq('opportunity_id', opportunityId)
      .maybeSingle();

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch requirement: ${error.message}`);
    return data ? toRow(data as RequirementWithLocationRows) : null;
  }

  /** The requirements of these opportunities, with their location ids; deals without one are absent. */
  async findByOpportunities(opportunityIds: string[], agencyId: string): Promise<RequirementWithLocationRows[]> {
    if (opportunityIds.length === 0) return [];
    const { data, error } = await this.db
      .from('requirements')
      .select('*, locations:requirement_locations!fk_requirement_locations_requirement(settlement_id, area_id)')
      .eq('agency_id', agencyId)
      .in('opportunity_id', opportunityIds);

    if (error) throw new DomainError('errors.loadFailed', `Failed to fetch requirements: ${error.message}`);
    return (data as RequirementWithLocationRows[]).map(toRow);
  }

  /**
   * `save_requirement`: replaces the whole requirement (a missing field is empty) and its
   * locations in one transaction. Returns the requirement id.
   */
  async save(opportunityId: string, fields: Record<string, unknown>, locations: RequirementLocationRow[]): Promise<string> {
    const { data, error } = await this.db.rpc('save_requirement', {
      p_opportunity_id: opportunityId,
      p_fields: fields,
      p_locations: locations,
    });

    if (error) throw requirementWriteFailure(error);
    return data as string;
  }

  /** `remove_requirement`: `notFound` when the deal has none. */
  async remove(opportunityId: string): Promise<void> {
    const { error } = await this.db.rpc('remove_requirement', { p_opportunity_id: opportunityId });
    if (error) throw requirementWriteFailure(error);
  }
}
