/**
 * Lead Source service.
 * Business logic on top of the repository.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadSourceRepository } from './repository';
import type { LeadSource, CreateLeadSourceInput, UpdateLeadSourceInput } from './types';
import { createLeadSourceSchema, updateLeadSourceSchema } from './validation';

export class LeadSourceService {
  private readonly repo: LeadSourceRepository;

  constructor(db: SupabaseClient) {
    this.repo = new LeadSourceRepository(db);
  }

  /** Returns all lead sources for the agency (active + inactive), ordered. */
  async listAll(agencyId: string): Promise<LeadSource[]> {
    return this.repo.findAll(agencyId);
  }

  /** Returns only active lead sources — for use in dropdowns. */
  async listActive(agencyId: string): Promise<LeadSource[]> {
    return this.repo.findActive(agencyId);
  }

  /** Returns a single lead source, or null if not found. */
  async getById(id: string, agencyId: string): Promise<LeadSource | null> {
    return this.repo.findById(id, agencyId);
  }

  /** Creates a new lead source after validation. */
  async create(agencyId: string, input: CreateLeadSourceInput): Promise<LeadSource> {
    const parsed = createLeadSourceSchema.parse(input);
    return this.repo.create(agencyId, parsed as CreateLeadSourceInput);
  }

  /** Updates an existing lead source after validation. */
  async update(
    id: string,
    agencyId: string,
    input: UpdateLeadSourceInput
  ): Promise<LeadSource> {
    const parsed = updateLeadSourceSchema.parse(input);
    return this.repo.update(id, agencyId, parsed as UpdateLeadSourceInput);
  }

  /**
   * Deactivates a lead source instead of deleting it.
   * Preferred over delete because existing inquiries/opportunities reference it.
   */
  async deactivate(id: string, agencyId: string): Promise<LeadSource> {
    return this.repo.update(id, agencyId, { is_active: false });
  }

  /**
   * Hard-deletes a lead source.
   * Only safe if the source is not referenced by any inquiry or opportunity.
   * Prefer deactivate() in most cases.
   */
  async delete(id: string, agencyId: string): Promise<void> {
    return this.repo.delete(id, agencyId);
  }
}
