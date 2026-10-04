/**
 * Lead Source repository.
 * All queries are automatically tenant-scoped via RLS.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { LeadSource, CreateLeadSourceInput, UpdateLeadSourceInput } from './types';

export class LeadSourceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(agencyId: string): Promise<LeadSource[]> {
    const { data, error } = await this.db
      .from('lead_sources')
      .select('*')
      .eq('agency_id', agencyId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch lead sources: ${error.message}`);
    return (data ?? []) as LeadSource[];
  }

  async findActive(agencyId: string): Promise<LeadSource[]> {
    const { data, error } = await this.db
      .from('lead_sources')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch active lead sources: ${error.message}`);
    return (data ?? []) as LeadSource[];
  }

  async findById(id: string, agencyId: string): Promise<LeadSource | null> {
    const { data, error } = await this.db
      .from('lead_sources')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw new Error(`Failed to fetch lead source: ${error.message}`);
    }
    return data as LeadSource;
  }

  async create(agencyId: string, input: CreateLeadSourceInput): Promise<LeadSource> {
    const { data, error } = await this.db
      .from('lead_sources')
      .insert({
        agency_id: agencyId,
        name: input.name,
        channel: input.channel,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create lead source: ${error.message}`);
    return data as LeadSource;
  }

  async update(id: string, agencyId: string, input: UpdateLeadSourceInput): Promise<LeadSource> {
    const { data, error } = await this.db
      .from('lead_sources')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.channel !== undefined && { channel: input.channel }),
        ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update lead source: ${error.message}`);
    return data as LeadSource;
  }

  async delete(id: string, agencyId: string): Promise<void> {
    const { error } = await this.db
      .from('lead_sources')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw new Error(`Failed to delete lead source: ${error.message}`);
  }
}
