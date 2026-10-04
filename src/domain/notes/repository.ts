import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note, CreateNoteInput, UpdateNoteInput } from './types';

export class NotesRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByContact(contactId: string, agencyId: string): Promise<Note[]> {
    const { data, error } = await this.db
      .from('notes')
      .select('*')
      .eq('contact_id', contactId)
      .eq('agency_id', agencyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch contact notes: ${error.message}`);
    return (data ?? []) as Note[];
  }

  async findByOpportunity(opportunityId: string, agencyId: string): Promise<Note[]> {
    const { data, error } = await this.db
      .from('notes')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('agency_id', agencyId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch opportunity notes: ${error.message}`);
    return (data ?? []) as Note[];
  }

  async create(agencyId: string, userId: string, input: CreateNoteInput): Promise<Note> {
    const { data, error } = await this.db
      .from('notes')
      .insert({
        agency_id: agencyId,
        contact_id: input.contact_id ?? null,
        opportunity_id: input.opportunity_id ?? null,
        content: input.content,
        is_pinned: input.is_pinned ?? false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create note: ${error.message}`);
    return data as Note;
  }

  async update(id: string, agencyId: string, input: UpdateNoteInput): Promise<Note> {
    const { data, error } = await this.db
      .from('notes')
      .update({
        ...(input.content !== undefined && { content: input.content }),
        ...(input.is_pinned !== undefined && { is_pinned: input.is_pinned }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update note: ${error.message}`);
    return data as Note;
  }

  async delete(id: string, agencyId: string): Promise<void> {
    const { error } = await this.db
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw new Error(`Failed to delete note: ${error.message}`);
  }
}
