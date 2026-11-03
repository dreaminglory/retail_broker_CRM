"use server";

import { revalidatePath } from 'next/cache';
import { AreaService } from '@/domain/areas/service';
import { createAreaSchema, reorderAreasSchema, updateAreaSchema } from '@/domain/areas/validation';
import { CONFIG_ROLES, getAuthContext, requireRole, toActionError, type ActionResult } from '@/lib/actions';

// Areas are owner/manager configuration (T6, AD-045).

export async function createAreaAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);

    const parsed = createAreaSchema.safeParse({
      settlement_id: formData.get('settlement_id'),
      name: formData.get('name'),
    });
    if (!parsed.success) return toActionError(parsed.error);

    await new AreaService(ctx.supabase).create(ctx.agencyId, parsed.data);
    revalidatePath('/settings/areas');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function updateAreaAction(id: string, _prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);

    const isActive = formData.get('is_active');
    const parsed = updateAreaSchema.safeParse({
      name: formData.get('name') ?? undefined,
      is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    if (!parsed.success) return toActionError(parsed.error);

    await new AreaService(ctx.supabase).update(id, ctx.agencyId, parsed.data);
    revalidatePath('/settings/areas');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function reorderAreasAction(areas: { id: string; sort_order: number }[]): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);

    const parsed = reorderAreasSchema.safeParse(areas);
    if (!parsed.success) return toActionError(parsed.error);

    await new AreaService(ctx.supabase).reorder(ctx.agencyId, parsed.data);
    revalidatePath('/settings/areas');
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
