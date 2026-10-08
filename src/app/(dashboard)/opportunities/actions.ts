"use server";

import { revalidatePath } from 'next/cache';
import { OpportunityService } from '@/domain/opportunities/service';
import { OpportunityRepository } from '@/domain/opportunities/repository';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  closeOpportunitySchema,
  addParticipantSchema,
} from '@/domain/opportunities/validation';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';
import { getAgencySettings } from '@/domain/agencies/settings';

export type { ActionResult };

// ── Opportunity actions ───────────────────────────────────────────────────────

export async function createOpportunityAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const settings = await getAgencySettings(agencyId);

    const raw = {
      title: formData.get('title'),
      type: formData.get('type'),
      stage_id: formData.get('stage_id'),
      source_id: formData.get('source_id') === 'none' ? null : (formData.get('source_id') || null),
      inquiry_id: formData.get('inquiry_id') === 'none' ? null : (formData.get('inquiry_id') || null),
      primary_contact_id: formData.get('primary_contact_id') === 'none' ? null : (formData.get('primary_contact_id') || null),
      assigned_to: formData.get('assigned_to') === 'none' ? null : (formData.get('assigned_to') || null),
      temperature: formData.get('temperature') || undefined,
      expected_value: formData.get('expected_value') ? Number(formData.get('expected_value')) : null,
      currency: formData.get('currency') || settings.default_currency,
      notes: formData.get('notes') || null,
    };

    const parsed = createOpportunitySchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new OpportunityService(supabase);
    const opportunity = await service.create(agencyId, userId, parsed.data);

    revalidatePath('/opportunities');
    return { success: true, data: { id: opportunity.id } };
  } catch (error) { return toActionError(error); }
}

export async function updateOpportunityAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const settings = await getAgencySettings(agencyId);

    const raw = {
      title: formData.get('title'),
      type: formData.get('type'),
      stage_id: formData.get('stage_id'),
      source_id: formData.get('source_id') === 'none' ? null : (formData.get('source_id') || null),
      inquiry_id: formData.get('inquiry_id') === 'none' ? null : (formData.get('inquiry_id') || null),
      primary_contact_id: formData.get('primary_contact_id') === 'none' ? null : (formData.get('primary_contact_id') || null),
      assigned_to: formData.get('assigned_to') === 'none' ? null : (formData.get('assigned_to') || null),
      temperature: formData.get('temperature') || undefined,
      expected_value: formData.get('expected_value') ? Number(formData.get('expected_value')) : null,
      currency: formData.get('currency') || settings.default_currency,
      notes: formData.get('notes') || null,
    };

    const parsed = updateOpportunitySchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new OpportunityService(supabase);
    await service.update(id, agencyId, parsed.data);

    revalidatePath('/opportunities');
    revalidatePath(`/opportunities/${id}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

/** Changes only the stage — thin wrapper used by stage-select dropdowns. */
export async function changeOpportunityStageAction(
  id: string,
  stageId: string
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new OpportunityService(supabase);
    await service.update(id, agencyId, { stage_id: stageId });
    revalidatePath('/opportunities');
    revalidatePath(`/opportunities/${id}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function closeOpportunityAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      outcome: formData.get('outcome'),
      lost_reason: formData.get('lost_reason') || null,
    };

    const parsed = closeOpportunitySchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new OpportunityService(supabase);
    await service.close(id, agencyId, parsed.data);

    revalidatePath('/opportunities');
    revalidatePath(`/opportunities/${id}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function reactivateOpportunityAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new OpportunityService(supabase);
    await service.reactivate(id, agencyId);
    revalidatePath('/opportunities');
    revalidatePath(`/opportunities/${id}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

// ── Participant actions ───────────────────────────────────────────────────────

export async function addParticipantAction(
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      contact_id: formData.get('contact_id') || null,
      user_id: formData.get('user_id') || null,
      role: formData.get('role'),
      notes: formData.get('notes') || null,
    };

    const parsed = addParticipantSchema.safeParse(raw);
    if (!parsed.success) return toActionError(parsed.error);

    const service = new OpportunityService(supabase);
    const participant = await service.addParticipant(opportunityId, agencyId, parsed.data);

    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: { id: participant.id } };
  } catch (error) { return toActionError(error); }
}

export async function removeParticipantAction(
  id: string,
  opportunityId: string
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new OpportunityService(supabase);
    await service.removeParticipant(id, agencyId);
    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function searchOpportunitiesQuickAction(search: string) {
  if (!search || search.length < 2) return [];
  const { supabase, agencyId } = await getAuthContext();
  const repo = new OpportunityRepository(supabase);
  return repo.findAll(agencyId, { search, limit: 5 });
}
