/**
 * Contact repository.
 * Handles contacts and their contact_methods as a unit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Contact,
  ContactMethod,
  ContactWithMethods,
  CreateContactInput,
  UpdateContactInput,
  AddContactMethodInput,
} from './types';
import { generateDisplayName, normalizeContactMethodValue } from './validation';

export interface ContactListOptions {
  /** Filter by status. Defaults to 'active'. */
  status?: 'active' | 'archived' | 'all';
  /** Search on display_name (case-insensitive). */
  search?: string;
  limit?: number;
  offset?: number;
}

export class ContactRepository {
  constructor(private readonly db: SupabaseClient) {}

  // ── Contacts ─────────────────────────────────────────────────────────────

  async findAll(agencyId: string, opts: ContactListOptions = {}): Promise<Contact[]> {
    const { status = 'active', search, limit = 50, offset = 0 } = opts;

    let query = this.db
      .from('contacts')
      .select('*')
      .eq('agency_id', agencyId)
      .order('display_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
    return (data ?? []) as Contact[];
  }

  async findById(id: string, agencyId: string): Promise<ContactWithMethods | null> {
    const { data, error } = await this.db
      .from('contacts')
      .select('*, contact_methods(*)')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }
    return data as ContactWithMethods;
  }

  async create(
    agencyId: string,
    userId: string,
    input: CreateContactInput
  ): Promise<ContactWithMethods> {
    const displayName = generateDisplayName(input.type, {
      first_name: input.first_name,
      last_name: input.last_name,
      company_name: input.company_name,
    });

    // Insert the contact row
    const { data: contact, error: contactError } = await this.db
      .from('contacts')
      .insert({
        agency_id: agencyId,
        type: input.type,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        company_name: input.company_name ?? null,
        display_name: displayName,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (contactError) throw new Error(`Failed to create contact: ${contactError.message}`);

    // Insert contact methods if provided
    const methods: ContactMethod[] = [];
    if (input.contact_methods && input.contact_methods.length > 0) {
      const methodRows = input.contact_methods.map((m) => ({
        contact_id: (contact as Contact).id,
        agency_id: agencyId,
        type: m.type,
        value: normalizeContactMethodValue(m.type, m.value),
        label: m.label ?? null,
        is_primary: m.is_primary ?? false,
      }));

      const { data: inserted, error: methodError } = await this.db
        .from('contact_methods')
        .insert(methodRows)
        .select();

      if (methodError) throw new Error(`Failed to save contact methods: ${methodError.message}`);
      methods.push(...((inserted ?? []) as ContactMethod[]));
    }

    return { ...(contact as Contact), contact_methods: methods };
  }

  async update(
    id: string,
    agencyId: string,
    input: UpdateContactInput
  ): Promise<ContactWithMethods> {
    // Fetch current record to recompute display_name if names changed
    const current = await this.findById(id, agencyId);
    if (!current) throw new Error('Contact not found');

    const displayName = generateDisplayName(current.type, {
      first_name: input.first_name !== undefined ? input.first_name : current.first_name,
      last_name: input.last_name !== undefined ? input.last_name : current.last_name,
      company_name: input.company_name !== undefined ? input.company_name : current.company_name,
    });

    const { data, error } = await this.db
      .from('contacts')
      .update({
        ...(input.first_name !== undefined && { first_name: input.first_name }),
        ...(input.last_name !== undefined && { last_name: input.last_name }),
        ...(input.company_name !== undefined && { company_name: input.company_name }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.status !== undefined && { status: input.status }),
        display_name: displayName,
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select('*, contact_methods(*)')
      .single();

    if (error) throw new Error(`Failed to update contact: ${error.message}`);
    return data as ContactWithMethods;
  }

  async archive(id: string, agencyId: string): Promise<Contact> {
    const { data, error } = await this.db
      .from('contacts')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive contact: ${error.message}`);
    return data as Contact;
  }

  // ── Contact Methods ───────────────────────────────────────────────────────

  async addContactMethod(
    contactId: string,
    agencyId: string,
    input: AddContactMethodInput
  ): Promise<ContactMethod> {
    // If this method is being set as primary, clear other primaries first
    if (input.is_primary) {
      await this.db
        .from('contact_methods')
        .update({ is_primary: false })
        .eq('contact_id', contactId)
        .eq('agency_id', agencyId);
    }

    const { data, error } = await this.db
      .from('contact_methods')
      .insert({
        contact_id: contactId,
        agency_id: agencyId,
        type: input.type,
        value: normalizeContactMethodValue(input.type, input.value),
        label: input.label ?? null,
        is_primary: input.is_primary ?? false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add contact method: ${error.message}`);
    return data as ContactMethod;
  }

  async removeContactMethod(id: string, agencyId: string): Promise<void> {
    const { error } = await this.db
      .from('contact_methods')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw new Error(`Failed to remove contact method: ${error.message}`);
  }

  async setPrimaryContactMethod(id: string, contactId: string, agencyId: string): Promise<void> {
    // Clear all primaries for this contact then set the chosen one
    const { error: clearError } = await this.db
      .from('contact_methods')
      .update({ is_primary: false })
      .eq('contact_id', contactId)
      .eq('agency_id', agencyId);

    if (clearError) throw new Error(`Failed to clear primary: ${clearError.message}`);

    const { error } = await this.db
      .from('contact_methods')
      .update({ is_primary: true })
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw new Error(`Failed to set primary contact method: ${error.message}`);
  }
}
