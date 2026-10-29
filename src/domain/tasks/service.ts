/**
 * Task service.
 * Validates inputs and enforces task lifecycle rules.
 * Sprint 2: Enhanced with "complete → schedule next" workflow (AD-014),
 * Today Screen query methods, and task_type support.
 * Sprint 6.2: due dates are read in agency time; edit, reschedule, cancel
 * and complete work on pending tasks only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TaskRepository } from './repository';
import type { AtRiskOpportunity } from './repository';
import type {
  Task,
  CreateTaskInput,
  CompleteTaskWithNextInput,
  CancelTaskInput,
  RescheduleTaskInput,
  UpdateTaskInput,
} from './types';
import { cancelTaskSchema, taskSchemas, type TaskSchemas } from './validation';
import { rescheduleDueAt } from './reschedule';
import type { TaskListOptions } from './repository';
import { DomainError } from '@/lib/errors';
import { DEFAULT_AGENCY_TIMEZONE, getTodayWindows } from '@/lib/time/agency-day';

export type TaskServiceOptions = {
  /** The agency's timezone; due dates without an offset are read in it. */
  timezone?: string;
};

export class TaskService {
  private readonly repo: TaskRepository;
  private readonly db: SupabaseClient;
  private readonly timezone: string;
  private readonly schemas: TaskSchemas;

  constructor(db: SupabaseClient, opts: TaskServiceOptions = {}) {
    this.db = db;
    this.repo = new TaskRepository(db);
    this.timezone = opts.timezone ?? DEFAULT_AGENCY_TIMEZONE;
    this.schemas = taskSchemas(this.timezone);
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

  /**
   * The Today task sections, each task in exactly one (agency time):
   * overdue (due before now), due today (now to midnight), upcoming (next 3 days).
   */
  async listToday(agencyId: string, assignedTo?: string): Promise<{ overdue: Task[]; dueToday: Task[]; upcoming: Task[] }> {
    const w = getTodayWindows(this.timezone);
    const [overdue, dueToday, upcoming] = await Promise.all([
      this.repo.findPendingDue(agencyId, { before: w.overdueBefore }, assignedTo),
      this.repo.findPendingDue(agencyId, w.dueToday, assignedTo),
      this.repo.findPendingDue(agencyId, w.upcoming, assignedTo),
    ]);
    return { overdue, dueToday, upcoming };
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
    const parsed = this.schemas.create.parse(input) as CreateTaskInput;
    
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

  /** Edits a pending task (title, description, task_type, due_at, assigned_to). */
  async update(id: string, agencyId: string, input: UpdateTaskInput): Promise<Task> {
    const parsed = this.schemas.update.parse(input);
    await this.getPending(id, agencyId);
    return this.repo.update(id, agencyId, parsed);
  }

  /**
   * Moves a pending task's due date to a preset (agency time) or a given date.
   * The trigger sync_opportunity_next_action recomputes next_action_at.
   */
  async reschedule(id: string, agencyId: string, input: RescheduleTaskInput): Promise<Task> {
    const due_at =
      'preset' in input
        ? rescheduleDueAt(input.preset, this.timezone).toISOString()
        : this.schemas.update.parse({ due_at: input.due_at }).due_at;
    if (!due_at) throw new DomainError('validation.invalid_date');
    await this.getPending(id, agencyId);
    return this.repo.update(id, agencyId, { due_at });
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
    const parsed = this.schemas.completeWithNext.parse(input);
    await this.getPending(id, agencyId);

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

  /** Cancels a pending task, keeping the optional reason as its outcome. */
  async cancel(id: string, agencyId: string, input: CancelTaskInput): Promise<Task> {
    const { reason } = cancelTaskSchema.parse(input);
    await this.getPending(id, agencyId);
    return this.repo.cancel(id, agencyId, reason ?? null);
  }

  /** Completed and cancelled tasks are final (Sprint 6.2). */
  private async getPending(id: string, agencyId: string): Promise<Task> {
    const task = await this.repo.findById(id, agencyId);
    if (!task) throw new DomainError('errors.task_not_found');
    if (task.status !== 'pending') throw new DomainError('errors.task_not_pending');
    return task;
  }
}
