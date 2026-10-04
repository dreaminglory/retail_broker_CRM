'use server';

import { revalidatePath } from 'next/cache';
import { TaskService } from '@/domain/tasks/service';
import { createTaskSchema, updateTaskSchema, completeTaskSchema } from '@/domain/tasks/validation';
import { getAuthContext, type ActionResult } from '@/lib/actions';

export type { ActionResult };

// ── Task actions ──────────────────────────────────────────────────────────────

export async function createTaskAction(
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const raw = {
      opportunity_id: opportunityId || null,
      contact_id: formData.get('contact_id') || null,
      title: formData.get('title'),
      description: formData.get('description') || null,
      due_at: formData.get('due_at') || null,
      assigned_to: formData.get('assigned_to') || null,
    };

    const parsed = createTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new TaskService(supabase);
    const task = await service.create(agencyId, userId, parsed.data);

    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: { id: task.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function updateTaskAction(
  id: string,
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      title: formData.get('title') ?? undefined,
      description: formData.get('description') !== null ? (formData.get('description') || null) : undefined,
      due_at: formData.get('due_at') !== null ? (formData.get('due_at') || null) : undefined,
      assigned_to: formData.get('assigned_to') !== null ? (formData.get('assigned_to') || null) : undefined,
    };

    const parsed = updateTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new TaskService(supabase);
    await service.update(id, agencyId, parsed.data);

    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Marks a task as completed with an optional outcome note.
 * The DB trigger sync_opportunity_next_action automatically updates
 * the parent opportunity's next_action_at (FR-TSK-07).
 */
export async function completeTaskAction(
  id: string,
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      outcome: formData.get('outcome') || null,
    };

    const parsed = completeTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new TaskService(supabase);
    await service.complete(id, agencyId, parsed.data);

    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function cancelTaskAction(
  id: string,
  opportunityId: string
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new TaskService(supabase);
    await service.cancel(id, agencyId);
    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
