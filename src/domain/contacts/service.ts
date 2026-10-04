/**
 * Contact service.
 * Validates inputs and delegates to the repository.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ContactRepository } from './repository';
import type {
  Contact,
  ContactMethod,
  ContactWithMethods,
  CreateContactInput,
  UpdateContactInput,
  AddContactMethodInput,
} from './types';
import {
  createContactSchema,
  updateContactSchema,
  addContactMethodSchema,
} from './validation';
import type { ContactListOptions } from './repository';

export class ContactService {
  private readonly repo: ContactRepository;

  constructor(db: SupabaseClient) {
    this.repo = new ContactRepository(db);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async list(agencyId: string, opts?: ContactListOptions): Promise<Contact[]> {
    return this.repo.findAll(agencyId, opts);
  }

  async getById(id: string, agencyId: string): Promise<ContactWithMethods | null> {
    return this.repo.findById(id, agencyId);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Creates a new contact with optional initial contact methods. */
  async create(
    agencyId: string,
    userId: string,
    input: CreateContactInput
  ): Promise<ContactWithMethods> {
    const parsed = createContactSchema.parse(input);
    return this.repo.create(agencyId, userId, parsed as CreateContactInput);
  }

  /** Updates mutable fields on an existing contact. */
  async update(
    id: string,
    agencyId: string,
    input: UpdateContactInput
  ): Promise<ContactWithMethods> {
    const parsed = updateContactSchema.parse(input);
    return this.repo.update(id, agencyId, parsed as UpdateContactInput);
  }

  /**
   * Archives a contact (soft delete).
   * Archived contacts remain referenceable by existing opportunities/inquiries.
   */
  async archive(id: string, agencyId: string): Promise<Contact> {
    return this.repo.archive(id, agencyId);
  }

  /** Adds a single contact method to an existing contact. */
  async addContactMethod(
    contactId: string,
    agencyId: string,
    input: AddContactMethodInput
  ): Promise<ContactMethod> {
    const parsed = addContactMethodSchema.parse(input);
    return this.repo.addContactMethod(contactId, agencyId, parsed as AddContactMethodInput);
  }

  /** Removes a contact method. */
  async removeContactMethod(id: string, agencyId: string): Promise<void> {
    return this.repo.removeContactMethod(id, agencyId);
  }

  /** Sets a contact method as the primary one (clears others first). */
  async setPrimaryContactMethod(
    id: string,
    contactId: string,
    agencyId: string
  ): Promise<void> {
    return this.repo.setPrimaryContactMethod(id, contactId, agencyId);
  }
}
