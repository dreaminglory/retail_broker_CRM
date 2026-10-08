"use server";

import { revalidatePath } from 'next/cache';
import { StageService } from '@/domain/stages/service';
import {
  createStageSchema,
  updateStageSchema,
  reorderStagesSchema,
} from '@/domain/stages/validation';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';
import type { ReorderStagesInput } from '@/domain/stages/validation';

export type { ActionResult };

const REVALIDATE_PATH = '/settings/stages';

// ── Create ────────────────────────────────────────────────────────────────────

export async function createStageAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      name: formData.get('name'),
      is_terminal: formData.get('is_terminal') === 'true',
      terminal_type: formData.get('terminal_type') || null,
    };

    const parsed = createStageSchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new StageService(supabase);
    await service.create(agencyId, parsed.data);

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateStageAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      name: formData.get('name') ?? undefined,
      is_terminal:
        formData.get('is_terminal') === 'true'
          ? true
          : formData.get('is_terminal') === 'false'
          ? false
          : undefined,
      terminal_type: formData.get('terminal_type') || undefined,
    };

    const parsed = updateStageSchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new StageService(supabase);
    await service.update(id, agencyId, parsed.data);

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Reorder ───────────────────────────────────────────────────────────────────

/**
 * Called directly (not via FormData) — stages array is passed as JSON.
 */
export async function reorderStagesAction(
  stages: ReorderStagesInput['stages']
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const parsed = reorderStagesSchema.safeParse({ stages });
    if (!parsed.success) return toActionError(parsed.error);

    const service = new StageService(supabase);
    await service.reorder(agencyId, parsed.data);

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteStageAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new StageService(supabase);
    await service.delete(id, agencyId);

    revalidatePath(REVALIDATE_PATH);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Get opportunity count (for pre-delete UI feedback) ───────────────────────

export async function getStageOpportunityCountAction(
  stageId: string
): Promise<ActionResult<number>> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new StageService(supabase);
    const count = await service.getOpportunityCount(stageId, agencyId);
    return { success: true, data: count };
  } catch (error) { return toActionError(error); }
}
