/**
 * Opportunity service.
 * Validates inputs and enforces business rules (e.g. lost_reason required for lost).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { OpportunityRepository } from './repository';
import type {
  Opportunity,
  OpportunityParticipant,
  OpportunityWithDetails,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  CloseOpportunityInput,
  AddParticipantInput,
} from './types';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  closeOpportunitySchema,
  addParticipantSchema,
} from './validation';
import type { OpportunityListOptions } from './repository';

export class OpportunityService {
  private readonly repo: OpportunityRepository;

  constructor(db: SupabaseClient) {
    this.repo = new OpportunityRepository(db);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async list(agencyId: string, opts?: OpportunityListOptions): Promise<Opportunity[]> {
    return this.repo.findAll(agencyId, opts);
  }

  async getById(id: string, agencyId: string): Promise<OpportunityWithDetails | null> {
    return this.repo.findById(id, agencyId);
  }

  async getByContactId(contactId: string, agencyId: string): Promise<Opportunity[]> {
    return this.repo.findByContactId(contactId, agencyId);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Creates a new opportunity after validation. */
  async create(
    agencyId: string,
    userId: string,
    input: CreateOpportunityInput
  ): Promise<Opportunity> {
    const parsed = createOpportunitySchema.parse(input);
    return this.repo.create(agencyId, userId, parsed as CreateOpportunityInput);
  }

  /** Updates mutable fields on an opportunity. */
  async update(
    id: string,
    agencyId: string,
    input: UpdateOpportunityInput
  ): Promise<Opportunity> {
    const parsed = updateOpportunitySchema.parse(input);
    return this.repo.update(id, agencyId, parsed as UpdateOpportunityInput);
  }

  /**
   * Closes an opportunity with outcome won/lost/nurture.
   * lost_reason is required when outcome === 'lost' (enforced by Zod schema).
   */
  async close(
    id: string,
    agencyId: string,
    input: CloseOpportunityInput
  ): Promise<Opportunity> {
    const parsed = closeOpportunitySchema.parse(input);
    return this.repo.close(id, agencyId, parsed as CloseOpportunityInput);
  }

  /**
   * Reactivates a closed opportunity — sets status back to 'active'.
   */
  async reactivate(id: string, agencyId: string): Promise<Opportunity> {
    return this.repo.reactivate(id, agencyId);
  }

  // ── Participants ──────────────────────────────────────────────────────────

  /** Adds a participant (contact or user) to an opportunity. */
  async addParticipant(
    opportunityId: string,
    agencyId: string,
    input: AddParticipantInput
  ): Promise<OpportunityParticipant> {
    const parsed = addParticipantSchema.parse(input);
    return this.repo.addParticipant(opportunityId, agencyId, parsed as AddParticipantInput);
  }

  /** Removes a participant from an opportunity. */
  async removeParticipant(id: string, agencyId: string): Promise<void> {
    return this.repo.removeParticipant(id, agencyId);
  }
}
