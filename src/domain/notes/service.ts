import type { SupabaseClient } from '@supabase/supabase-js';
import { NotesRepository } from './repository';
import { createNoteSchema, updateNoteSchema } from './validation';
import type { Note, CreateNoteInput, UpdateNoteInput } from './types';

export class NotesService {
  private readonly repository: NotesRepository;

  constructor(db: SupabaseClient) {
    this.repository = new NotesRepository(db);
  }

  async getContactNotes(contactId: string, agencyId: string): Promise<Note[]> {
    return this.repository.findByContact(contactId, agencyId);
  }

  async getOpportunityNotes(opportunityId: string, agencyId: string): Promise<Note[]> {
    return this.repository.findByOpportunity(opportunityId, agencyId);
  }

  async createNote(agencyId: string, userId: string, input: CreateNoteInput): Promise<Note> {
    const validated = createNoteSchema.parse(input);
    return this.repository.create(agencyId, userId, validated);
  }

  async updateNote(id: string, agencyId: string, userId: string, input: UpdateNoteInput): Promise<Note> {
    const validated = updateNoteSchema.parse(input);
    
    // Guard: Only the author should ideally edit their note, but in some CRMs, 
    // managers can edit too. For simplicity, we just pass to repo since RLS handles tenant isolation.
    // If we wanted to enforce author-only edit, we'd fetch the note first and check created_by === userId.
    return this.repository.update(id, agencyId, validated);
  }

  async deleteNote(id: string, agencyId: string, userId: string): Promise<void> {
    // Similarly, author/manager guard could be here.
    return this.repository.delete(id, agencyId);
  }
}
