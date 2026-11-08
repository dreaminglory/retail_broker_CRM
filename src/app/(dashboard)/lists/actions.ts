"use server";

/**
 * Saved smart list actions (spec: smart-lists rules 3–5). The filters come as the entity list's
 * URL params and are mapped here, the same way the list page reads them.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SmartListService } from '@/domain/smart-lists/service';
import { inquiryFilterFromParams, opportunityFilterFromParams } from '@/domain/smart-lists/url-filter';
import type { SmartListEntity } from '@/domain/smart-lists/types';
import { getAuthContext, requireRole, toActionError, type ActionResult } from '@/lib/actions';
import { MANAGER_ROLES } from '@/lib/roles';

const idSchema = z.string().uuid();
const entitySchema = z.enum(['opportunity', 'inquiry']);
const paramsSchema = z.record(z.string().max(40), z.string().max(400)).refine((p) => Object.keys(p).length <= 30);

const saveSchema = z.object({ name: z.string(), entity: entitySchema, params: paramsSchema });
const renameSchema = z.object({ id: idSchema, name: z.string() });
const updateFilterSchema = z.object({ id: idSchema, entity: entitySchema, params: paramsSchema });
const idInputSchema = z.object({ id: idSchema });

function filterFromParams(entity: SmartListEntity, params: Record<string, string>) {
  return entity === 'opportunity' ? opportunityFilterFromParams(params) : inquiryFilterFromParams(params);
}

function revalidateList(id?: string) {
  revalidatePath('/lists');
  if (id) revalidatePath(`/lists/${id}`);
}

export async function saveListAction(input: {
  name: string;
  entity: SmartListEntity;
  params: Record<string, string>;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);
    const ctx = await getAuthContext();
    const { name, entity, params } = parsed.data;
    const list = await new SmartListService(ctx.supabase).save(ctx, {
      name,
      entity,
      filter: filterFromParams(entity, params),
    });
    revalidateList();
    return { success: true, data: { id: list.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function renameListAction(input: { id: string; name: string }): Promise<ActionResult> {
  try {
    const parsed = renameSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);
    const ctx = await getAuthContext();
    await new SmartListService(ctx.supabase).rename(ctx, parsed.data.id, parsed.data.name);
    revalidateList(parsed.data.id);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateListFilterAction(input: {
  id: string;
  entity: SmartListEntity;
  params: Record<string, string>;
}): Promise<ActionResult> {
  try {
    const parsed = updateFilterSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);
    const ctx = await getAuthContext();
    const { id, entity, params } = parsed.data;
    await new SmartListService(ctx.supabase).updateFilter(ctx, id, filterFromParams(entity, params));
    revalidateList(id);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteListAction(input: { id: string }): Promise<ActionResult> {
  try {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);
    const ctx = await getAuthContext();
    await new SmartListService(ctx.supabase).remove(ctx, parsed.data.id);
    revalidateList(parsed.data.id);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

/** Owners and managers only (rule 4); the service and RLS check it again. */
export async function shareListAction(input: { id: string }): Promise<ActionResult> {
  return setShared(input, true);
}

/** Only the list's creator, an owner or manager, may unshare it (rule 4). */
export async function unshareListAction(input: { id: string }): Promise<ActionResult> {
  return setShared(input, false);
}

async function setShared(input: { id: string }, shared: boolean): Promise<ActionResult> {
  try {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);
    const ctx = await getAuthContext();
    requireRole(ctx, MANAGER_ROLES);
    const service = new SmartListService(ctx.supabase);
    if (shared) await service.share(ctx, parsed.data.id);
    else await service.unshare(ctx, parsed.data.id);
    revalidateList(parsed.data.id);
    return { success: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
