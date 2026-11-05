"use server";

/** The requirement on a buyer or tenant deal (spec: requirements; AD-059). */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { RequirementService } from '@/domain/requirements/service';
import { requirementInputSchema } from '@/domain/requirements/validation';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

/** Creates or replaces the requirement; any member who can see the deal may (rule 7). */
export async function saveRequirementAction(opportunityId: string, input: unknown): Promise<ActionResult> {
  try {
    const id = z.string().uuid().safeParse(opportunityId);
    if (!id.success) return toActionError(id.error);
    const parsed = requirementInputSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);

    const { supabase, agencyId } = await getAuthContext();
    await new RequirementService(supabase).save(agencyId, id.data, parsed.data);
    revalidatePath(`/opportunities/${id.data}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

/** Deletes the requirement; its audit entries stay on the timeline (rule 8). */
export async function removeRequirementAction(opportunityId: string): Promise<ActionResult> {
  try {
    const id = z.string().uuid().safeParse(opportunityId);
    if (!id.success) return toActionError(id.error);

    const { supabase, agencyId } = await getAuthContext();
    await new RequirementService(supabase).remove(agencyId, id.data);
    revalidatePath(`/opportunities/${id.data}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
