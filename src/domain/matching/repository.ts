import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { OpportunityMatchRow, PropertyMatchRow } from './types';

type ListArgs = { includeLinked: boolean; limit: number; offset: number };

/** Calls the two list functions. They run as the caller, so RLS and the agency filter apply. */
export class MatchingRepository {
  constructor(private readonly db: SupabaseClient) {}

  async propertiesForOpportunity(opportunityId: string, args: ListArgs): Promise<PropertyMatchRow[]> {
    const { data, error } = await this.db.rpc('match_properties', {
      p_opportunity_id: opportunityId,
      p_include_linked: args.includeLinked,
      p_limit: args.limit,
      p_offset: args.offset,
    });
    if (error) throw new DomainError('errors.loadFailed', `Failed to match properties: ${error.message}`);
    return (data ?? []) as PropertyMatchRow[];
  }

  async opportunitiesForProperty(propertyId: string, args: ListArgs): Promise<OpportunityMatchRow[]> {
    const { data, error } = await this.db.rpc('match_opportunities', {
      p_property_id: propertyId,
      p_include_linked: args.includeLinked,
      p_limit: args.limit,
      p_offset: args.offset,
    });
    if (error) throw new DomainError('errors.loadFailed', `Failed to match opportunities: ${error.message}`);
    return (data ?? []) as OpportunityMatchRow[];
  }
}
