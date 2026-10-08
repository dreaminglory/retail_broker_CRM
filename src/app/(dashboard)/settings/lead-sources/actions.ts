"use server";

import { revalidatePath } from 'next/cache';
import { LeadSourceService } from '@/domain/lead-sources/service';
import { createLeadSourceSchema, updateLeadSourceSchema } from '@/domain/lead-sources/validation';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

export type { ActionResult };

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createLeadSourceAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      name: formData.get('name'),
      channel: formData.get('channel'),
      sort_order: formData.get('sort_order') ? Number(formData.get('sort_order')) : undefined,
    };

    const parsed = createLeadSourceSchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new LeadSourceService(supabase);
    await service.create(agencyId, parsed.data);

    revalidatePath('/settings/lead-sources');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function updateLeadSourceAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      name: formData.get('name') ?? undefined,
      channel: formData.get('channel') ?? undefined,
      sort_order: formData.get('sort_order') ? Number(formData.get('sort_order')) : undefined,
      is_active: formData.get('is_active') === 'true' ? true : formData.get('is_active') === 'false' ? false : undefined,
    };

    const parsed = updateLeadSourceSchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new LeadSourceService(supabase);
    await service.update(id, agencyId, parsed.data);

    revalidatePath('/settings/lead-sources');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function deactivateLeadSourceAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new LeadSourceService(supabase);
    await service.deactivate(id, agencyId);
    revalidatePath('/settings/lead-sources');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
