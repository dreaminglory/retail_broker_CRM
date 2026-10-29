"use server";

/**
 * Task Server Actions, shared by the opportunity page and Today.
 * Due dates without an offset are read in the agency's timezone (Sprint 6.2).
 * next_action_at is maintained by the sync_opportunity_next_action trigger.
 */

import { revalidatePath } from 'next/cache';
import { TaskService } from '@/domain/tasks/service';
import { taskSchemas } from '@/domain/tasks/validation';
import type {
  CancelTaskInput,
  CompleteTaskWithNextInput,
  RescheduleTaskInput,
  Task,
  UpdateTaskInput,
} from '@/domain/tasks/types';
import { getAgencySettings } from '@/domain/agencies/settings';
import { getAuthContext, toActionError, type ActionResult, type AuthContext } from '@/lib/actions';

export type { ActionResult };

async function taskServiceFor(ctx: AuthContext) {
  const { timezone } = await getAgencySettings(ctx.agencyId);
  return { service: new TaskService(ctx.supabase, { timezone }), timezone };
}

function revalidateTask(task: Pick<Task, 'opportunity_id'>) {
  revalidatePath('/today');
  if (task.opportunity_id) revalidatePath(`/opportunities/${task.opportunity_id}`);
}

// ── Task actions ──────────────────────────────────────────────────────────────

export async function createTaskAction(
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await getAuthContext();
    const { service, timezone } = await taskServiceFor(ctx);

    const raw = {
      opportunity_id: opportunityId || null,
      contact_id: formData.get('contact_id') || null,
      title: formData.get('title'),
      description: formData.get('description') || null,
      due_at: formData.get('due_at') || null,
      assigned_to: formData.get('assigned_to') || null,
    };

    const parsed = taskSchemas(timezone).create.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const task = await service.create(ctx.agencyId, ctx.userId, parsed.data);

    revalidateTask(task);
    return { success: true, data: { id: task.id } };
  } catch (error) { return toActionError(error); }
}

/** Edits a pending task (FR-TSK-08). */
export async function updateTaskAction(id: string, input: UpdateTaskInput): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    const { service } = await taskServiceFor(ctx);
    const task = await service.update(id, ctx.agencyId, input);
    revalidateTask(task);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

/**
 * Completes a task with its outcome, and optionally schedules the next task
 * and moves the opportunity's stage, in one step (AD-014, FR-TSK-04).
 */
export async function completeTaskAction(
  id: string,
  input: CompleteTaskWithNextInput
): Promise<ActionResult<{ completedTask: Task; nextTask?: Task }>> {
  try {
    const ctx = await getAuthContext();
    const { service } = await taskServiceFor(ctx);
    const result = await service.completeWithNext(id, ctx.agencyId, ctx.userId, input);
    revalidateTask(result.completedTask);
    return { success: true, data: result };
  } catch (error) { return toActionError(error); }
}

/** Moves a pending task to a preset (agency time) or a given date (FR-TSK-08). */
export async function rescheduleTaskAction(id: string, input: RescheduleTaskInput): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    const { service } = await taskServiceFor(ctx);
    const task = await service.reschedule(id, ctx.agencyId, input);
    revalidateTask(task);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

/** Cancels a pending task with an optional reason (FR-TSK-08). */
export async function cancelTaskAction(id: string, input: CancelTaskInput): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    const { service } = await taskServiceFor(ctx);
    const task = await service.cancel(id, ctx.agencyId, input);
    revalidateTask(task);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
