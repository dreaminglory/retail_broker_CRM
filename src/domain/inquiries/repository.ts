/**
 * Inquiry repository.
 * Inquiries are immutable inbound events — status advances forward only (FR-INQ-04).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Inquiry, CreateInquiryInput, UpdateInquiryInput } from './types';

export interface InquiryListOptions {
  status?: 'new' | 'contacted' | 'converted' | 'dismissed' | 'all';
  assignedTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class InquiryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(agencyId: string, opts: InquiryListOptions = {}): Promise<Inquiry[]> {
    const { status = 'all', assignedTo, search, limit = 50, offset = 0 } = opts;

    let query = this.db
      .from('inquiries')
      .select('*')
      .eq('agency_id', agencyId)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (search) {
      // Search across caller name, phone, email, and subject
      query = query.or(
        `caller_name.ilike.%${search}%,caller_phone.ilike.%${search}%,caller_email.ilike.%${search}%,subject.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch inquiries: ${error.message}`);
    return (data ?? []) as Inquiry[];
  }

  async findById(id: string, agencyId: string): Promise<Inquiry | null> {
    const { data, error } = await this.db
      .from('inquiries')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch inquiry: ${error.message}`);
    }
    return data as Inquiry;
  }

  async create(agencyId: string, userId: string, input: CreateInquiryInput): Promise<Inquiry> {
    const { data, error } = await this.db
      .from('inquiries')
      .insert({
        agency_id: agencyId,
        source_id: input.source_id ?? null,
        source_description: input.source_description ?? null,
        caller_name: input.caller_name ?? null,
        caller_phone: input.caller_phone ?? null,
        caller_email: input.caller_email ?? null,
        subject: input.subject ?? null,
        description: input.description ?? null,
        external_ref: input.external_ref ?? null,
        assigned_to: input.assigned_to ?? null,
        raw_payload: input.raw_payload ?? {},
        status: 'new',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create inquiry: ${error.message}`);
    return data as Inquiry;
  }

  async update(id: string, agencyId: string, input: UpdateInquiryInput): Promise<Inquiry> {
    const { data, error } = await this.db
      .from('inquiries')
      .update({
        ...(input.source_id !== undefined && { source_id: input.source_id }),
        ...(input.source_description !== undefined && { source_description: input.source_description }),
        ...(input.contact_id !== undefined && { contact_id: input.contact_id }),
        ...(input.opportunity_id !== undefined && { opportunity_id: input.opportunity_id }),
        ...(input.assigned_to !== undefined && { assigned_to: input.assigned_to }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.dismissed_reason !== undefined && { dismissed_reason: input.dismissed_reason }),
        ...(input.caller_name !== undefined && { caller_name: input.caller_name }),
        ...(input.caller_phone !== undefined && { caller_phone: input.caller_phone }),
        ...(input.caller_email !== undefined && { caller_email: input.caller_email }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.description !== undefined && { description: input.description }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update inquiry: ${error.message}`);
    return data as Inquiry;
  }
}
