"use server";

/** Property links on an opportunity (spec: properties, rules 5–7). Both pages show a link. */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { OpportunityPropertyService } from '@/domain/opportunity-properties/service';
import type { OpportunityProperty } from '@/domain/opportunity-properties/types';
import { addCandidateSchema, setLinkStatusSchema } from '@/domain/opportunity-properties/validation';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

function revalidateLink(link: Pick<OpportunityProperty, 'opportunity_id' | 'property_id'>) {
  revalidatePath(`/opportunities/${link.opportunity_id}`);
  revalidatePath(`/properties/${link.property_id}`);
}

export async function addCandidatePropertyAction(
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { supabase, agencyId, userId } = await getAuthContext();
    const parsed = addCandidateSchema.safeParse({
      opportunity_id: opportunityId,
      property_id: formData.get('property_id') || undefined,
    });
    if (!parsed.success) return toActionError(parsed.error);

    const link = await new OpportunityPropertyService(supabase).addCandidate(agencyId, userId, parsed.data);
    revalidateLink(link);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function setPropertyLinkStatusAction(
  linkId: string,
  input: { status: string; rejected_reason?: string | null },
): Promise<ActionResult> {
  try {
    const id = z.string().uuid().safeParse(linkId);
    if (!id.success) return toActionError(id.error);
    const parsed = setLinkStatusSchema.safeParse(input);
    if (!parsed.success) return toActionError(parsed.error);

    const { supabase, agencyId } = await getAuthContext();
    const link = await new OpportunityPropertyService(supabase).setStatus(id.data, agencyId, parsed.data);
    revalidateLink(link);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function removePropertyLinkAction(linkId: string): Promise<ActionResult> {
  try {
    const id = z.string().uuid().safeParse(linkId);
    if (!id.success) return toActionError(id.error);

    const { supabase, agencyId } = await getAuthContext();
    const link = await new OpportunityPropertyService(supabase).remove(id.data, agencyId);
    revalidateLink(link);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
