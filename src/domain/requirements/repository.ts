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
 * Reads only: members can't write either table, so writes go through the AD-059 RPCs in the
 * service.
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
}
