/**
 * Task repository.
 * AD-005 (Sprint 1): Minimal task entity.
 * Sprint 2: Enhanced with Today Screen queries, at-risk detection,
 * and task_type support.
 * The next_action_at on Opportunity is maintained by DB trigger (FR-TSK-07).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import type { Task, CreateTaskInput, CompleteTaskInput } from './types';

export interface TaskListOptions {
  opportunityId?: string;
  contactId?: string;
  assignedTo?: string;
  status?: 'pending' | 'completed' | 'cancelled' | 'all';
  taskType?: string;
  limit?: number;
  offset?: number;
}

/** Represents an active opportunity with no pending task. */
export interface AtRiskOpportunity {
  id: string;
  title: string;
  stage_name: string;
  type: string;
  temperature: string | null;
  assigned_to: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * The row a write guarded by `status = 'pending'` returned. No row means someone
 * completed or cancelled the task after the service checked it.
 */
function pendingWriteResult(data: unknown, error: { message: string } | null, verb: string): Task {
  if (error) throw new Error(`Failed to ${verb} task: ${error.message}`);
  if (!data) throw new DomainError('errors.task_not_pending');
  return data as Task;
}

export class TaskRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(agencyId: string, opts: TaskListOptions = {}): Promise<Task[]> {
    const {
      opportunityId,
      contactId,
      assignedTo,
      status = 'pending',
      taskType,
      limit = 50,
      offset = 0,
    } = opts;

    let query = this.db
      .from('tasks')
      .select('*')
      .eq('agency_id', agencyId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (opportunityId) {
      query = query.eq('opportunity_id', opportunityId);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return (data ?? []) as Task[];
  }

  async findById(id: string, agencyId: string): Promise<Task | null> {
    const { data, error } = await this.db
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch task: ${error.message}`);
    }
    return data as Task;
  }

  // ── Today Screen Queries ─────────────────────────────────────────────────

  /**
   * Pending tasks due in the half-open range [from, before), soonest first.
   * Today's sections come from `getTodayWindows`, so each task is in one only.
   */
  async findPendingDue(
    agencyId: string,
    range: { from?: string; before: string },
    assignedTo?: string
  ): Promise<Task[]> {
    let query = this.db
      .from('tasks')
      .select('*, opportunities(title, stages(name))')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .lt('due_at', range.before)
      .order('due_at', { ascending: true });

    if (range.from) {
      query = query.gte('due_at', range.from);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);

    // Map joined fields to flat TaskWithOpportunity structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      ...row,
      opportunity_title: row.opportunities?.title ?? null,
      opportunity_stage: row.opportunities?.stages?.name ?? null,
      opportunities: undefined,
    })) as Task[];
  }

  /**
   * At-risk opportunities: active opportunities assigned to the user
   * that have NO pending task (next_action_at IS NULL).
   */
  async findAtRiskOpportunities(agencyId: string, assignedTo?: string): Promise<AtRiskOpportunity[]> {
    let query = this.db
      .from('opportunities')
      .select('id, title, type, temperature, assigned_to, updated_at, created_at, stages!inner(name)')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .is('next_action_at', null);

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch at-risk opportunities: ${error.message}`);

    // Map the joined stage name
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stage_name: (row.stages as any)?.name ?? 'Unknown',
      type: row.type as string,
      temperature: row.temperature as string | null,
      assigned_to: row.assigned_to as string | null,
      updated_at: row.updated_at as string,
      created_at: row.created_at as string,
    }));
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async create(agencyId: string, userId: string, input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.db
      .from('tasks')
      .insert({
        agency_id: agencyId,
        opportunity_id: input.opportunity_id ?? null,
        contact_id: input.contact_id ?? null,
        title: input.title,
        description: input.description ?? null,
        task_type: input.task_type ?? null,
        due_at: input.due_at ?? null,
        assigned_to: input.assigned_to ?? null,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    return data as Task;
  }

  async update(
    id: string,
    agencyId: string,
    input: Partial<Pick<Task, 'title' | 'description' | 'task_type' | 'due_at' | 'assigned_to'>>
  ): Promise<Task> {
    const { data, error } = await this.db
      .from('tasks')
      .update({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.task_type !== undefined && { task_type: input.task_type }),
        ...(input.due_at !== undefined && { due_at: input.due_at }),
        ...(input.assigned_to !== undefined && { assigned_to: input.assigned_to }),
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .eq('status', 'pending') // Guard: only a pending task can be edited (Sprint 6.2)
      .select()
      .maybeSingle();

    return pendingWriteResult(data, error, 'update');
  }

  /**
   * Completes a task. Sets status → 'completed', completed_at → now, stores outcome.
   * The DB trigger sync_opportunity_next_action updates the parent opportunity's
   * next_action_at automatically (FR-TSK-07).
   */
  async complete(
    id: string,
    agencyId: string,
    input: CompleteTaskInput
  ): Promise<Task> {
    const { data, error } = await this.db
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        outcome: input.outcome,
      })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .eq('status', 'pending') // Guard: can only complete a pending task (L-004)
      .select()
      .maybeSingle();

    return pendingWriteResult(data, error, 'complete');
  }

  /** Cancels a pending task. The optional reason is kept as its `outcome`. */
  async cancel(id: string, agencyId: string, reason: string | null): Promise<Task> {
    const { data, error } = await this.db
      .from('tasks')
      .update({ status: 'cancelled', outcome: reason })
      .eq('id', id)
      .eq('agency_id', agencyId)
      .eq('status', 'pending') // Guard: can only cancel a pending task (L-004)
      .select()
      .maybeSingle();

    return pendingWriteResult(data, error, 'cancel');
  }
}
