'use server';

import { revalidatePath } from 'next/cache';
import { ContactService } from '@/domain/contacts/service';
import { createContactSchema, updateContactSchema, addContactMethodSchema } from '@/domain/contacts/validation';
import { findPotentialDuplicates, type PotentialDuplicate } from '@/domain/contacts/duplicate-detection';
import { ContactRepository } from '@/domain/contacts/repository';
import { getAuthContext, type ActionResult } from '@/lib/actions';

export type { ActionResult };

// ── Contact actions ───────────────────────────────────────────────────────────

export async function createContactAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string } | { duplicates: PotentialDuplicate[] }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    // contact_methods is JSON-encoded from the form
    let contact_methods: unknown[] = [];
    const methodsRaw = formData.get('contact_methods');
    if (typeof methodsRaw === 'string' && methodsRaw) {
      try {
        contact_methods = JSON.parse(methodsRaw);
      } catch {
        return { success: false, error: 'Invalid contact methods format' };
      }
    }

    const raw = {
      type: formData.get('type'),
      first_name: formData.get('first_name') || null,
      last_name: formData.get('last_name') || null,
      company_name: formData.get('company_name') || null,
      notes: formData.get('notes') || null,
      contact_methods,
    };

    const parsed = createContactSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const skipDuplicateCheck = formData.get('skipDuplicateCheck') === 'true';
    if (!skipDuplicateCheck) {
      const duplicates = await findPotentialDuplicates(supabase, agencyId, parsed.data as Record<string, unknown>);
      if (duplicates.length > 0) {
        return { success: true, data: { duplicates } };
      }
    }

    const service = new ContactService(supabase);
    const contact = await service.create(agencyId, userId, parsed.data);

    revalidatePath('/contacts');
    return { success: true, data: { id: contact.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function updateContactAction(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      first_name: formData.get('first_name') !== null ? (formData.get('first_name') || null) : undefined,
      last_name: formData.get('last_name') !== null ? (formData.get('last_name') || null) : undefined,
      company_name: formData.get('company_name') !== null ? (formData.get('company_name') || null) : undefined,
      notes: formData.get('notes') !== null ? (formData.get('notes') || null) : undefined,
      status: formData.get('status') || undefined,
    };

    const parsed = updateContactSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new ContactService(supabase);
    await service.update(id, agencyId, parsed.data);

    revalidatePath(`/contacts/${id}`);
    revalidatePath('/contacts');
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function archiveContactAction(id: string): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new ContactService(supabase);
    await service.archive(id, agencyId);
    revalidatePath('/contacts');
    revalidatePath(`/contacts/${id}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── Contact method actions ────────────────────────────────────────────────────

export async function addContactMethodAction(
  contactId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, agencyId } = await getAuthContext();

    const raw = {
      type: formData.get('type'),
      value: formData.get('value'),
      label: formData.get('label') || null,
      is_primary: formData.get('is_primary') === 'true',
    };

    const parsed = addContactMethodSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const service = new ContactService(supabase);
    const method = await service.addContactMethod(contactId, agencyId, parsed.data);

    revalidatePath(`/contacts/${contactId}`);
    return { success: true, data: { id: method.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function removeContactMethodAction(
  id: string,
  contactId: string
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new ContactService(supabase);
    await service.removeContactMethod(id, agencyId);
    revalidatePath(`/contacts/${contactId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function setPrimaryContactMethodAction(
  id: string,
  contactId: string
): Promise<ActionResult> {
  try {
    const { supabase, agencyId } = await getAuthContext();
    const service = new ContactService(supabase);
    await service.setPrimaryContactMethod(id, contactId, agencyId);
    revalidatePath(`/contacts/${contactId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function searchContactsQuickAction(search: string) {
  if (!search || search.length < 2) return [];
  const { supabase, agencyId } = await getAuthContext();
  const repo = new ContactRepository(supabase);
  return repo.findAll(agencyId, { search, limit: 5, status: 'active' });
}
