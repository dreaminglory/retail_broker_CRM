"use server";

import { ContactMergeService } from "@/domain/contacts/merge";
import { ContactRepository } from "@/domain/contacts/repository";
import type { MergePreview } from "@/domain/contacts/merge-types";
import type { Contact } from "@/domain/contacts/types";
import { CONFIG_ROLES, getAuthContext, requireRole, toActionError, type ActionResult } from "@/lib/actions";
import { revalidatePath } from "next/cache";

// Merging contacts is owner/manager only (AD-045), and so are its preview and search.

export async function getMergePreviewAction(
  winnerId: string,
  loserId: string
): Promise<ActionResult<MergePreview>> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);

    const mergeService = new ContactMergeService(ctx.supabase);
    const preview = await mergeService.getPreview(ctx.agencyId, winnerId, loserId);
    return { success: true, data: preview };
  } catch (error) { return toActionError(error); }
}

export async function mergeContactsAction(
  winnerId: string,
  loserId: string
): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);

    const mergeService = new ContactMergeService(ctx.supabase);
    await mergeService.merge(ctx.agencyId, ctx.userId, winnerId, loserId);

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${winnerId}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function searchContactsForMergeAction(
  search: string,
  currentContactId: string
): Promise<ActionResult<Contact[]>> {
  try {
    const ctx = await getAuthContext();
    requireRole(ctx, CONFIG_ROLES);

    const repo = new ContactRepository(ctx.supabase);
    const contacts = await repo.findAll(ctx.agencyId, { search, limit: 10, status: 'active' });

    // Filter out the current contact
    return { success: true, data: contacts.filter(c => c.id !== currentContactId) };
  } catch (error) { return toActionError(error); }
}
