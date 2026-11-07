/**
 * Opportunity service.
 * Validates inputs and enforces business rules (e.g. lost_reason required for lost).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { OpportunityRepository } from './repository';
import type {
  Opportunity,
  OpportunityParticipant,
  OpportunityWithDetails,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  CloseOpportunityInput,
  AddParticipantInput,
  OpportunityListOptions,
} from './types';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  closeOpportunitySchema,
  addParticipantSchema,
  opportunityStatusSchema,
} from './validation';

import { SmartListRepository } from '../smart-lists/repository';
import type { OpportunityListFilter } from '../smart-lists/validation';

const ALL_STATUSES = opportunityStatusSchema.options;

/** The list page's options as a smart list filter (newest first, as the list always was). */
export function toListFilter(opts: OpportunityListOptions): OpportunityListFilter {
  const filter: OpportunityListFilter = {
    status: opts.status === 'all' ? [...ALL_STATUSES] : [opts.status ?? 'active'],
  };
  if (opts.type && opts.type !== 'all') filter.type = [opts.type];
  if (opts.stageId && opts.stageId !== 'all') filter.stage_id = [opts.stageId];
  if (opts.temperature) filter.temperature = [opts.temperature];
  if (opts.assignedTo) filter.assigned_to = opts.assignedTo;
  if (opts.sourceId) filter.source_id = [opts.sourceId];
  if (opts.nextAction) filter.next_action = opts.nextAction;
  if (opts.noTouchDays) filter.no_touch_days = opts.noTouchDays;
  if (opts.hasNewMatches) filter.has_new_matches = true;
  if (opts.search?.trim()) filter.search = opts.search.trim();
  return filter;
}

export class OpportunityService {
  private readonly repo: OpportunityRepository;
  private readonly lists: SmartListRepository;

  constructor(db: SupabaseClient) {
    this.repo = new OpportunityRepository(db);
    this.lists = new SmartListRepository(db);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * One page of the opportunity list plus the total that match. Reads through
   * smart_list_opportunities (AD-062), so the list and a list saved from it always agree. The
   * function filters by the caller's agency; the rows are checked against `agencyId` here too.
   */
  async listPage(
    agencyId: string,
    opts: OpportunityListOptions = {}
  ): Promise<{ rows: Opportunity[]; total: number }> {
    const { limit = 50, offset = 0 } = opts;
    const list = { entity: 'opportunity' as const, filter: toListFilter(opts) };
    const page = await this.lists.listRows(list, { limit, offset });
    if (page.rows.some((row) => row.agency_id !== agencyId)) {
      throw new DomainError('errors.loadFailed', 'smart_list_opportunities returned rows of another agency');
    }
    if (page.rows.length === 0 && offset > 0) {
      // Past the last row the function returns no rows, so no total: ask for it, so loadPage can
      // fall back to the last page.
      const first = await this.lists.listRows(list, { limit: 1, offset: 0 });
      return { rows: [], total: first.total };
    }
    return { rows: page.rows, total: page.total };
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
