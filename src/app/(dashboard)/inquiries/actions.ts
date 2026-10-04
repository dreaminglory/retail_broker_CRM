'use server';

import { revalidatePath } from 'next/cache';
import { InquiryService } from '@/domain/inquiries/service';
import { createInquirySchema, updateInquirySchema, convertInquirySchema } from '@/domain/inquiries/validation';
import { findPotentialDuplicates, type PotentialDuplicate } from '@/domain/contacts/duplicate-detection';
import { InquiryRepository } from '@/domain/inquiries/repository';
import { getAuthContext, type ActionResult } from '@/lib/actions';

export type { ActionResult };

// ── Inquiry actions ───────────────────────────────────────────────────────────

export async function createInquiryAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const raw = {
      source_id: formData.get('source_id') || null,
      source_description: formData.get('source_description') || null,
      caller_name: formData.get('caller_name') || null,
      caller_phone: formData.get('caller_phone') || null,
      caller_email: formData.get('caller_email') || null,
      subject: formData.get('subject') || null,
      description: formData.get('description') || null,
      external_ref: formData.get('external_ref') || null,
      assigned_to: formData.get('assigned_to') || null,
    };

    const parsed = createInquirySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new InquiryService(supabase);
    const inquiry = await service.create(agencyId, userId, parsed.data);

    revalidatePath('/inquiries');
    return { success: true, data: { id: inquiry.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function updateInquiryAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      source_id: formData.get('source_id') ?? undefined,
      source_description: formData.get('source_description') ?? undefined,
      assigned_to: formData.get('assigned_to') || null,
      caller_name: formData.get('caller_name') ?? undefined,
      caller_phone: formData.get('caller_phone') ?? undefined,
      caller_email: formData.get('caller_email') ?? undefined,
      subject: formData.get('subject') ?? undefined,
      description: formData.get('description') ?? undefined,
    };

    const parsed = updateInquirySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new InquiryService(supabase);
    await service.update(id, agencyId, parsed.data);

    revalidatePath('/inquiries');
    revalidatePath(`/inquiries/${id}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function markInquiryContactedAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new InquiryService(supabase);
    await service.markContacted(id, agencyId);
    revalidatePath('/inquiries');
    revalidatePath(`/inquiries/${id}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function dismissInquiryAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const service = new InquiryService(supabase);
    await service.dismiss(id, agencyId, {
      dismissed_reason: (formData.get('dismissed_reason') as string) || null,
    });

    revalidatePath('/inquiries');
    revalidatePath(`/inquiries/${id}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Converts an inquiry to an opportunity.
 * Returns opportunityId + contactId on success so the UI can redirect.
 */
export async function convertInquiryAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ opportunityId: string; contactId: string | null } | { duplicates: PotentialDuplicate[] }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    // create_contact is JSON-encoded — it's optional
    let create_contact: unknown = undefined;
    const createContactRaw = formData.get('create_contact');
    if (typeof createContactRaw === 'string' && createContactRaw) {
      try {
        create_contact = JSON.parse(createContactRaw);
      } catch {
        return { success: false, error: 'Invalid create_contact format' };
      }
    }

    const raw = {
      contact_id: formData.get('contact_id') || undefined,
      create_contact,
      opportunity_title: formData.get('opportunity_title'),
      opportunity_type: formData.get('opportunity_type'),
      stage_id: formData.get('stage_id'),
      assigned_to: formData.get('assigned_to') || null,
    };

    const parsed = convertInquirySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const skipDuplicateCheck = formData.get('skipDuplicateCheck') === 'true';
    if (parsed.data.create_contact && !skipDuplicateCheck) {
      const duplicates = await findPotentialDuplicates(supabase, agencyId, parsed.data.create_contact as Record<string, unknown>);
      if (duplicates.length > 0) {
        return { success: true, data: { duplicates } };
      }
    }

    const service = new InquiryService(supabase);
    const result = await service.convert(id, agencyId, userId, parsed.data);

    revalidatePath('/inquiries');
    revalidatePath('/opportunities');
    revalidatePath(`/inquiries/${id}`);
    return {
      success: true,
      data: { opportunityId: result.opportunityId, contactId: result.contactId },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function searchInquiriesQuickAction(search: string) {
  if (!search || search.length < 2) return [];
  const { supabase, agencyId } = await getAuthContext();
  const repo = new InquiryRepository(supabase);
  return repo.findAll(agencyId, { search, limit: 5 });
}
