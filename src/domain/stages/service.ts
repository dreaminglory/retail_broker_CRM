import { DomainError } from "@/lib/errors";
/**
 * Stage service.
 * Sprint 2 (AD-006): Full CRUD with business-rule validation.
 *
 * Business rules enforced here:
 * - Cannot delete a stage that has active opportunities.
 * - Must always have at least one 'won' terminal stage and one 'lost' terminal stage.
 * - Reorder only applies to stages belonging to the caller's agency.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { StageRepository } from './repository';
import type { Stage } from './types';
import {
  createStageSchema,
  updateStageSchema,
  reorderStagesSchema,
  type CreateStageInput,
  type UpdateStageInput,
  type ReorderStagesInput,
} from './validation';

export class StageService {
  private readonly repo: StageRepository;

  constructor(db: SupabaseClient) {
    this.repo = new StageRepository(db);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async list(agencyId: string): Promise<Stage[]> {
    return this.repo.findAll(agencyId);
  }

  async listActive(agencyId: string): Promise<Stage[]> {
    return this.repo.findActive(agencyId);
  }

  async getById(id: string, agencyId: string): Promise<Stage | null> {
    return this.repo.findById(id, agencyId);
  }

  /**
   * Returns the opportunity count for a stage.
   * Used by the UI to show \"X active opportunities\" before delete.
   */
  async getOpportunityCount(stageId: string, agencyId: string): Promise<number> {
    return this.repo.countOpportunitiesByStage(stageId, agencyId);
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async create(agencyId: string, input: CreateStageInput): Promise<Stage> {
    const parsed = createStageSchema.parse(input);
    return this.repo.create(agencyId, parsed as CreateStageInput);
  }

  async update(id: string, agencyId: string, input: UpdateStageInput): Promise<Stage> {
    const parsed = updateStageSchema.parse(input);

    // If changing a terminal stage to non-terminal, guard the invariant:
    // there must remain at least one won and one lost terminal stage.
    if (parsed.is_terminal === false) {
      const existing = await this.repo.findById(id, agencyId);
      if (!existing) throw new DomainError('errors.not_found');

      if (existing.terminal_type === 'won') {
        const wonStages = await this.repo.findByTerminalType(agencyId, 'won');
        if (wonStages.length <= 1) {
          throw new DomainError('errors.stages.last_won_stage');
        }
      }
      if (existing.terminal_type === 'lost') {
        const lostStages = await this.repo.findByTerminalType(agencyId, 'lost');
        if (lostStages.length <= 1) {
          throw new DomainError('errors.stages.last_lost_stage');
        }
      }
    }

    return this.repo.update(id, agencyId, parsed as UpdateStageInput);
  }

  async reorder(agencyId: string, input: ReorderStagesInput): Promise<void> {
    const parsed = reorderStagesSchema.parse(input);
    await this.repo.reorder(agencyId, parsed.stages);
  }

  /**
   * Deletes a stage after validating:
   * 1. No active opportunities are using this stage.
   * 2. The stage is not the last Won or Lost terminal stage.
   */
  async delete(id: string, agencyId: string): Promise<void> {
    const stage = await this.repo.findById(id, agencyId);
    if (!stage) throw new DomainError('errors.not_found');

    // Guard: active opportunities block deletion
    const oppCount = await this.repo.countOpportunitiesByStage(id, agencyId);
    if (oppCount > 0) {
      throw new DomainError('errors.stages.delete_has_opportunities', undefined, { count: oppCount });
    }

    // Guard: terminal stage invariant
    if (stage.terminal_type === 'won') {
      const wonStages = await this.repo.findByTerminalType(agencyId, 'won');
      if (wonStages.length <= 1) {
        throw new DomainError('errors.stages.last_won_stage');
      }
    }
    if (stage.terminal_type === 'lost') {
      const lostStages = await this.repo.findByTerminalType(agencyId, 'lost');
      if (lostStages.length <= 1) {
        throw new DomainError('errors.stages.last_lost_stage');
      }
    }

    await this.repo.delete(id, agencyId);
  }
}
