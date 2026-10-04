/**
 * Opportunity repository.
 * Handles opportunities, participants, and stage transitions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Opportunity,
  OpportunityParticipant,
  OpportunityWithDetails,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  CloseOpportunityInput,
  AddParticipantInput,
} from './types';

export interface OpportunityListOptions {
  status?: 'active' | 'won' | 'lost' | 'nurture' | 'archived' | 'all';
  assignedTo?: string;
  stageId?: string;
  type?: 'buyer' | 'seller' | 'landlord' | 'tenant' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export class OpportunityRepository {
  constructor(private readonly db: SupabaseClient) {}

  // ── Opportunities ─────────────────────────────────────────────────────────

  async findAll(
    agencyId: string,
    opts: OpportunityListOptions = {}
  ): Promise<Opportunity[]> {
    const { status = 'active', assignedTo, stageId, search, limit = 50, offset = 0 } = opts;

    let query = this.db
      .from('opportunities')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (stageId && stageId !== 'all') {
      query = query.eq('stage_id', stageId);
    }
    if (opts.type && opts.type !== 'all') {
      query = query.eq('type', opts.type);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch opportunities: ${error.message}`);
    return (data ?? []) as Opportunity[];
  }

  async findById(id: string, agencyId: string): Promise<OpportunityWithDetails | null> {
    const { data, error } = await this.db
      .from('opportunities')
      .select('*, participants:opportunity_participants(*)')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch opportunity: ${error.message}`);
    }
    return data as OpportunityWithDetails;
  }

  async findByContactId(contactId: string, agencyId: string): Promise<Opportunity[]> {
    const [primaryRes, participantRes] = await Promise.all([
      this.db
        .from('opportunities')
        .select('*')
        .eq('primary_contact_id', contactId)
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false }),
      this.db
        .from('opportunity_participants')
        .select('opportunity_id, opportunities(*)')
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId)
    ]);

    if (primaryRes.error) throw new Error(`Failed to fetch primary opportunities: ${primaryRes.error.message}`);
    if (participantRes.error) throw new Error(`Failed to fetch participant opportunities: ${participantRes.error.message}`);

    const oppsMap = new Map<string, Opportunity>();
    
    // Add primary opportunities first
    for (const opp of (primaryRes.data as Opportunity[])) {
      oppsMap.set(opp.id, opp);
    }
    
    // Add opportunities where contact is a participant
    for (const row of participantRes.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = row.opportunities as any;
      if (opp && !Array.isArray(opp) && !oppsMap.has(opp.id)) {
        oppsMap.set(opp.id, opp as Opportunity);
      }
    }
    
    // Convert to array and sort: active first, then by updated_at desc
    const allOpps = Array.from(oppsMap.values());
    allOpps.sort((a, b) => {
      // Sort by status (active first)
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      // Then by updated_at desc
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return dateB - dateA;
    });

    return allOpps;
  }

  async create(
    agencyId: string,
    userId: string,
    input: CreateOpportunityInput
  ): Promise<Opportunity> {
    const { data, error } = await this.db
      .from('opportunities')
      .insert({
        agency_id: agencyId,
        title: input.title,
        type: input.type,
        stage_id: input.stage_id,
        source_id: input.source_id ?? null,
        inquiry_id: input.inquiry_id ?? null,
        primary_contact_id: input.primary_contact_id ?? null,
        assigned_to: input.assigned_to ?? null,
        temperature: input.temperature ?? 'warm',
        expected_value: input.expected_value ?? null,
        currency: input.currency ?? 'BGN',
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create opportunity: ${error.message}`);
    return data as Opportunity;
  }

  async update(
    id: string,
    agencyId: string,
    input: UpdateOpportunityInput
  ): Promise<Opportunity> {
    const { data, error } = await this.db
      .from('opportunities')
      .update({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.stage_id !== undefined && { stage_id: input.stage_id }),
        ...(input.source_id !== undefined && { source_id: input.source_id }),
        ...(input.primary_contact_id !== undefined && { primary_contact_id: input.primary_contact_id }),
        ...(input.assigned_to !== undefined && { assigned_to: input.assigned_to }),
        ...(input.temperature !== undefined && { temperature: input.temperature }),
        ...(input.expected_value !== undefined && { expected_value: input.expected_value }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.notes !== undefined && { notes: input.notes }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update opportunity: ${error.message}`);
    return data as Opportunity;
  }

  /**
   * Closes an opportunity (won/lost/nurture).
   * Sets status, closed_at, and optionally lost_reason.
   */
  async close(
    id: string,
    agencyId: string,
    input: CloseOpportunityInput
  ): Promise<Opportunity> {
    const statusMap: Record<string, string> = {
      won: 'won',
      lost: 'lost',
      nurture: 'nurture',
    };

    const { data, error } = await this.db
      .from('opportunities')
      .update({
        status: statusMap[input.outcome],
        closed_at: new Date().toISOString(),
        ...(input.lost_reason !== undefined && { lost_reason: input.lost_reason }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to close opportunity: ${error.message}`);
    return data as Opportunity;
  }

  /** Reactivates a closed opportunity: sets status → 'active', clears closed_at and lost_reason. */
  async reactivate(id: string, agencyId: string): Promise<Opportunity> {
    const { data, error } = await this.db
      .from('opportunities')
      .update({ status: 'active', closed_at: null, lost_reason: null })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reactivate opportunity: ${error.message}`);
    return data as Opportunity;
  }

  // ── Participants ──────────────────────────────────────────────────────────

  async addParticipant(
    opportunityId: string,
    agencyId: string,
    input: AddParticipantInput
  ): Promise<OpportunityParticipant> {
    const { data, error } = await this.db
      .from('opportunity_participants')
      .insert({
        opportunity_id: opportunityId,
        agency_id: agencyId,
        contact_id: input.contact_id ?? null,
        user_id: input.user_id ?? null,
        role: input.role,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add participant: ${error.message}`);
    return data as OpportunityParticipant;
  }

  async removeParticipant(id: string, agencyId: string): Promise<void> {
    const { error } = await this.db
      .from('opportunity_participants')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw new Error(`Failed to remove participant: ${error.message}`);
  }
}
