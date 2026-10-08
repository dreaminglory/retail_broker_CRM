/**
 * Task service.
 * Validates inputs and enforces task lifecycle rules.
 * Sprint 2: Enhanced with "complete → schedule next" workflow (AD-014),
 * Today Screen query methods, and task_type support.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TaskRepository } from './repository';
import type { AtRiskOpportunity } from './repository';
import type { Task, CreateTaskInput, CompleteTaskInput, CompleteTaskWithNextInput } from './types';
import {
  createTaskSchema,
  completeTaskSchema,
  completeTaskWithNextSchema,
  updateTaskSchema,
} from './validation';
import type { TaskListOptions } from './repository';

export class TaskService {
  private readonly repo: TaskRepository;
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
    this.repo = new TaskRepository(db);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async list(agencyId: string, opts?: TaskListOptions): Promise<Task[]> {
    return this.repo.findAll(agencyId, opts);
  }

  /** Convenience: list pending tasks for a specific opportunity. */
  async listForOpportunity(opportunityId: string, agencyId: string): Promise<Task[]> {
    return this.repo.findAll(agencyId, { opportunityId, status: 'pending' });
  }

  async getById(id: string, agencyId: string): Promise<Task | null> {
    return this.repo.findById(id, agencyId);
  }

  // ── Today Screen Queries ─────────────────────────────────────────────────

  /** Overdue tasks: pending with due_at in the past. */
  async listOverdue(agencyId: string, assignedTo?: string): Promise<Task[]> {
    return this.repo.findOverdue(agencyId, assignedTo);
  }

  /** Tasks due today. */
  async listDueToday(agencyId: string, assignedTo?: string, timezone: string = 'Europe/Sofia'): Promise<Task[]> {
    return this.repo.findDueToday(agencyId, assignedTo, timezone);
  }

  /** Tasks due in the next 3 days (excluding today). */
  async listUpcoming(agencyId: string, assignedTo?: string, timezone: string = 'Europe/Sofia'): Promise<Task[]> {
    return this.repo.findUpcoming(agencyId, assignedTo, 3, timezone);
  }

  /** Active opportunities with no pending task. */
  async listAtRisk(agencyId: string, assignedTo?: string): Promise<AtRiskOpportunity[]> {
    return this.repo.findAtRiskOpportunities(agencyId, assignedTo);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Creates a new pending task after validation. */
  async create(
    agencyId: string,
    userId: string,
    input: CreateTaskInput
  ): Promise<Task> {
    const parsed = createTaskSchema.parse(input) as CreateTaskInput;
    
    // Automatically inherit assigned_to from the opportunity if not provided
    if (!parsed.assigned_to && parsed.opportunity_id) {
      const { data } = await this.db
        .from('opportunities')
        .select('assigned_to')
        .eq('id', parsed.opportunity_id)
        .single();
      if (data?.assigned_to) {
        parsed.assigned_to = data.assigned_to;
      }
    }

    return this.repo.create(agencyId, userId, parsed);
  }

  /** Updates mutable fields (title, description, task_type, due_at, assigned_to). */
  async update(
    id: string,
    agencyId: string,
    input: Partial<Pick<Task, 'title' | 'description' | 'task_type' | 'due_at' | 'assigned_to'>>
  ): Promise<Task> {
    const parsed = updateTaskSchema.parse(input);
    return this.repo.update(id, agencyId, parsed);
  }

  /**
   * Completes a task (simple — outcome required per AD-014).
   * DB trigger sync_opportunity_next_action updates next_action_at.
   */
  async complete(
    id: string,
    agencyId: string,
    input: CompleteTaskInput
  ): Promise<Task> {
    const parsed = completeTaskSchema.parse(input);
    return this.repo.complete(id, agencyId, parsed as CompleteTaskInput);
  }

  /**
   * Full "complete → schedule next" workflow (AD-014).
   * 1. Validates the combined input
   * 2. Completes the current task with the outcome
   * 3. Optionally creates the next task on the same opportunity
   * 4. Optionally advances the opportunity to a new stage
   *
   * Soft enforcement: next_task and new_stage_id are optional.
   */
  async completeWithNext(
    id: string,
    agencyId: string,
    userId: string,
    input: CompleteTaskWithNextInput
  ): Promise<{ completedTask: Task; nextTask?: Task }> {
    const parsed = completeTaskWithNextSchema.parse(input);

    // 1. Complete the current task
    const completedTask = await this.repo.complete(id, agencyId, {
      outcome: parsed.outcome,
    });

    let nextTask: Task | undefined;

    // 2. Optionally create the next task
    if (parsed.next_task) {
      // Inherit the opportunity and assigned_to from the completed task
      const nextInput: CreateTaskInput = {
        ...(parsed.next_task as CreateTaskInput),
        opportunity_id: parsed.next_task.opportunity_id ?? completedTask.opportunity_id,
        assigned_to: parsed.next_task.assigned_to ?? completedTask.assigned_to,
      };
      nextTask = await this.repo.create(agencyId, userId, nextInput);
    }

    // 3. Optionally change the opportunity stage
    if (parsed.new_stage_id && completedTask.opportunity_id) {
      await this.db
        .from('opportunities')
        .update({ stage_id: parsed.new_stage_id })
        .eq('id', completedTask.opportunity_id)
        .eq('agency_id', agencyId);
    }

    return { completedTask, nextTask };
  }

  /** Cancels a pending task. */
  async cancel(id: string, agencyId: string): Promise<Task> {
    return this.repo.cancel(id, agencyId);
  }
}
