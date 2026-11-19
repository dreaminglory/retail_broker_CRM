/**
 * Call log (spec phone-loop rules 2, 6, 8; AD-065).
 *
 * A logged call is a completed `call` (or `email`) task. If the context has a pending call of
 * the person acting, the call completes it through `TaskService.completeWithNext`; otherwise the
 * completed call and its optional next task go in one multi-row insert. The `tasks` triggers keep
 * `next_action_at` and the inquiry's `contacted_at` and status; nothing here writes them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '@/lib/errors';
import { DEFAULT_AGENCY_TIMEZONE } from '@/lib/time/agency-day';
import { InquiryRepository } from '@/domain/inquiries/repository';
import type { InquiryStatus } from '@/domain/inquiries/types';
import { OpportunityRepository } from '@/domain/opportunities/repository';
import { TaskRepository, type CallScope } from '@/domain/tasks/repository';
import { TaskService } from '@/domain/tasks/service';
import { isToday18Available, rescheduleDueAt, type DuePreset } from '@/domain/tasks/reschedule';
import type { Task, TaskType } from '@/domain/tasks/types';
import { logCallSchema } from './validation';
import type {
  CallChannel,
  CallContext,
  CallTask,
  CallTitles,
  CompletableTask,
  LogCallInput,
  LogCallResult,
} from './types';

/** The context after it was checked against the agency and a converted inquiry's deal added. */
type ResolvedContext = CallScope & {
  task_id: string | null;
  opportunityStatus: string | null;
  inquiryStatus: InquiryStatus | null;
};

const taskTypeFor = (channel: CallChannel): TaskType => (channel === 'email' ? 'email' : 'call');

export class CallService {
  private readonly db: SupabaseClient;
  private readonly timezone: string;
  private readonly repo: TaskRepository;
  private readonly tasks: TaskService;

  constructor(db: SupabaseClient, opts: { timezone?: string } = {}) {
    this.db = db;
    this.timezone = opts.timezone ?? DEFAULT_AGENCY_TIMEZONE;
    this.repo = new TaskRepository(db);
    this.tasks = new TaskService(db, { timezone: this.timezone });
  }

  /**
   * The pending task a call would complete ("Completes: <title>", rule 6): the tapped task if it
   * is mine and of the channel's type, else my earliest one on the deal or inquiry.
   */
  async findTaskToComplete(
    agencyId: string,
    userId: string,
    context: CallContext,
    channel: CallChannel
  ): Promise<CompletableTask | null> {
    const ctx = await this.resolveContext(agencyId, context);
    const task = await this.pickTask(agencyId, userId, ctx, channel);
    return task && { id: task.id, title: task.title, due_at: task.due_at };
  }

  async log(
    agencyId: string,
    userId: string,
    input: LogCallInput,
    titles: CallTitles,
    now: Date = new Date()
  ): Promise<LogCallResult> {
    const parsed = logCallSchema(this.timezone).parse(input);
    const ctx = await this.resolveContext(agencyId, parsed.context);

    // Rule 8: a closed deal keeps its stage; a dismissed inquiry gets no retry.
    if (parsed.new_stage_id && ctx.opportunityStatus !== 'active') {
      throw new DomainError('phoneLoop.errors.stageClosed');
    }
    if (parsed.next && ctx.inquiryStatus === 'dismissed') {
      throw new DomainError('phoneLoop.errors.noRetryDismissed');
    }

    const dueAt = parsed.next ? this.dueAt(parsed.next, now) : null;
    const scope: CallScope = {
      opportunity_id: ctx.opportunity_id,
      contact_id: ctx.contact_id,
      inquiry_id: ctx.inquiry_id,
    };
    const next = dueAt
      ? { ...scope, title: parsed.result === 'answered' ? titles.followUp : titles.retry, due_at: dueAt, assigned_to: userId }
      : null;

    if (parsed.complete_task_id) {
      const task = await this.repo.findById(parsed.complete_task_id, agencyId);
      if (!task || !this.isCompletable(task, userId, ctx, parsed.channel)) {
        throw new DomainError('phoneLoop.errors.taskNotCompletable');
      }
      const { completedTask, nextTask } = await this.tasks.completeWithNext(
        task.id,
        agencyId,
        userId,
        {
          outcome: parsed.outcome,
          next_task: next && { ...next, task_type: 'call' },
          new_stage_id: parsed.new_stage_id ?? null,
        },
        { channel: parsed.channel }
      );
      return { callTask: completedTask as CallTask, nextTask: nextTask as CallTask | undefined };
    }

    const saved = await this.repo.insertCallLog(
      agencyId,
      userId,
      {
        ...scope,
        title: titles.call,
        task_type: taskTypeFor(parsed.channel),
        channel: parsed.channel,
        outcome: parsed.outcome,
        assigned_to: userId,
      },
      next
    );
    if (parsed.new_stage_id && ctx.opportunity_id) {
      await this.moveStage(ctx.opportunity_id, agencyId, parsed.new_stage_id);
    }
    return { callTask: saved.call as CallTask, nextTask: saved.next as CallTask | undefined };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Checks every id against the agency (filter in code, RLS is the net) and follows conversion. */
  private async resolveContext(agencyId: string, context: CallContext): Promise<ResolvedContext> {
    const resolved: ResolvedContext = {
      opportunity_id: context.opportunity_id ?? null,
      contact_id: context.contact_id ?? null,
      inquiry_id: context.inquiry_id ?? null,
      task_id: context.task_id ?? null,
      opportunityStatus: null,
      inquiryStatus: null,
    };

    if (resolved.inquiry_id) {
      const inquiry = await new InquiryRepository(this.db).findById(resolved.inquiry_id, agencyId);
      if (!inquiry) throw new DomainError('errors.not_found');
      resolved.inquiryStatus = inquiry.status;
      // A converted inquiry's context is its deal (rule 8).
      resolved.opportunity_id ??= inquiry.opportunity_id;
      resolved.contact_id ??= inquiry.contact_id;
    }

    if (resolved.opportunity_id) {
      const deal = await new OpportunityRepository(this.db).findById(resolved.opportunity_id, agencyId);
      if (!deal) throw new DomainError('errors.not_found');
      resolved.opportunityStatus = deal.status;
      resolved.contact_id ??= deal.primary_contact_id;
    }

    // A contact taken from the inquiry or the deal is already in the agency; a given one is checked.
    if (context.contact_id) {
      const { data, error } = await this.db
        .from('contacts')
        .select('id')
        .eq('id', resolved.contact_id)
        .eq('agency_id', agencyId)
        .maybeSingle();
      if (error) throw new DomainError('errors.loadFailed', `Failed to fetch the call's contact: ${error.message}`);
      if (!data) throw new DomainError('errors.not_found');
    }

    return resolved;
  }

  private async pickTask(agencyId: string, userId: string, ctx: ResolvedContext, channel: CallChannel): Promise<Task | null> {
    if (ctx.task_id) {
      const tapped = await this.repo.findById(ctx.task_id, agencyId);
      if (tapped && this.isCompletable(tapped, userId, ctx, channel)) return tapped;
    }
    return this.repo.findEarliestPendingOf(agencyId, userId, taskTypeFor(channel), {
      opportunityId: ctx.opportunity_id,
      inquiryId: ctx.inquiry_id,
    });
  }

  /** Mine, pending, of the channel's type (tasks_channel_check), and in this context. */
  private isCompletable(task: Task, userId: string, ctx: ResolvedContext, channel: CallChannel): boolean {
    if (task.status !== 'pending' || task.assigned_to !== userId) return false;
    if (task.task_type !== taskTypeFor(channel)) return false;
    return (
      task.id === ctx.task_id ||
      (!!ctx.opportunity_id && task.opportunity_id === ctx.opportunity_id) ||
      (!!ctx.inquiry_id && task.inquiry_id === ctx.inquiry_id)
    );
  }

  private dueAt(next: { preset: DuePreset } | { due_at: string }, now: Date): string {
    if ('due_at' in next) return next.due_at;
    const { preset } = next;
    if (preset === 'today_18' && !isToday18Available(this.timezone, now)) {
      throw new DomainError('phoneLoop.errors.today18Passed');
    }
    return rescheduleDueAt(preset, this.timezone, now).toISOString();
  }

  /** The same stage move as `completeWithNext` (AD-014). */
  private async moveStage(opportunityId: string, agencyId: string, stageId: string): Promise<void> {
    const { error } = await this.db
      .from('opportunities')
      .update({ stage_id: stageId })
      .eq('id', opportunityId)
      .eq('agency_id', agencyId);
    if (error) throw new DomainError('errors.saveFailed', `Failed to move the stage: ${error.message}`);
  }
}
