/**
 * Stage repository.
 * Sprint 2 (AD-006): Full CRUD configurability added.
 * Sprint 1 had seeded read-only defaults via migration 20260901000003.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Stage } from './types';
import type { CreateStageInput, UpdateStageInput } from './validation';

export class StageRepository {
  constructor(private readonly db: SupabaseClient) {}

  // ── Queries ─────────────────────────────────────────────────────────────────

  /** Returns all stages for the agency, ordered by sort_order. */
  async findAll(agencyId: string): Promise<Stage[]> {
    const { data, error } = await this.db
      .from('stages')
      .select('*')
      .eq('agency_id', agencyId)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch stages: ${error.message}`);
    return (data ?? []) as Stage[];
  }

  /** Returns only non-terminal stages (for moving opportunities through the pipeline). */
  async findActive(agencyId: string): Promise<Stage[]> {
    const { data, error } = await this.db
      .from('stages')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_terminal', false)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch active stages: ${error.message}`);
    return (data ?? []) as Stage[];
  }

  async findById(id: string, agencyId: string): Promise<Stage | null> {
    const { data, error } = await this.db
      .from('stages')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch stage: ${error.message}`);
    }
    return data as Stage;
  }

  /** Find stages by terminal type — used to enforce at-least-one invariant. */
  async findByTerminalType(
    agencyId: string,
    terminalType: 'won' | 'lost' | 'nurture'
  ): Promise<Stage[]> {
    const { data, error } = await this.db
      .from('stages')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('terminal_type', terminalType);

    if (error) throw new Error(`Failed to fetch stages by terminal type: ${error.message}`);
    return (data ?? []) as Stage[];
  }

  /**
   * Returns the count of active opportunities for a given stage.
   * Used to guard against deleting stages that still have opportunities.
   */
  async countOpportunitiesByStage(stageId: string, agencyId: string): Promise<number> {
    const { count, error } = await this.db
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('stage_id', stageId)
      .eq('agency_id', agencyId)
      .eq('status', 'active');

    if (error) throw new Error(`Failed to count opportunities for stage: ${error.message}`);
    return count ?? 0;
  }

  /** Returns the highest current sort_order for the agency (for appending new stages). */
  async getMaxSortOrder(agencyId: string): Promise<number> {
    const { data, error } = await this.db
      .from('stages')
      .select('sort_order')
      .eq('agency_id', agencyId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to get max sort_order: ${error.message}`);
    return (data?.sort_order ?? -1) as number;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async create(agencyId: string, input: CreateStageInput): Promise<Stage> {
    // If sort_order not provided, append at the end
    const sort_order =
      input.sort_order ?? (await this.getMaxSortOrder(agencyId)) + 1;

    const { data, error } = await this.db
      .from('stages')
      .insert({
        agency_id: agencyId,
        name: input.name,
        sort_order,
        is_terminal: input.is_terminal ?? false,
        terminal_type: input.terminal_type ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create stage: ${error.message}`);
    return data as Stage;
  }

  async update(id: string, agencyId: string, input: UpdateStageInput): Promise<Stage> {
    const updatePayload: Record<string, unknown> = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.is_terminal !== undefined) updatePayload.is_terminal = input.is_terminal;
    // Allow explicit null to clear terminal_type
    if ('terminal_type' in input) updatePayload.terminal_type = input.terminal_type ?? null;

    const { data, error } = await this.db
      .from('stages')
      .update(updatePayload)
      .eq('id', id)
      .eq('agency_id', agencyId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update stage: ${error.message}`);
    return data as Stage;
  }

  /**
   * Bulk-updates sort_order for a set of stages.
   * Called from StageService.reorder() after validation.
   */
  async reorder(
    agencyId: string,
    stages: Array<{ id: string; sort_order: number }>
  ): Promise<void> {
    // Supabase doesn't support bulk updates natively — issue one update per row.
    // For the small counts expected in pilot this is acceptable.
    for (const { id, sort_order } of stages) {
      const { error } = await this.db
        .from('stages')
        .update({ sort_order })
        .eq('id', id)
        .eq('agency_id', agencyId);

      if (error) throw new Error(`Failed to reorder stage ${id}: ${error.message}`);
    }
  }

  async delete(id: string, agencyId: string): Promise<void> {
    const { error } = await this.db
      .from('stages')
      .delete()
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) throw new Error(`Failed to delete stage: ${error.message}`);
  }
}
