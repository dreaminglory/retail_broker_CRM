"use server";

import { revalidatePath } from 'next/cache';
import { NotesService } from '@/domain/notes/service';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

export async function createContactNoteAction(
  contactId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const raw = {
      contact_id: contactId,
      content: formData.get('content') as string,
      is_pinned: formData.get('is_pinned') === 'true',
    };

    const service = new NotesService(supabase);
    const note = await service.createNote(agencyId, userId, raw);

    revalidatePath(`/contacts/${contactId}`);
    return { success: true, data: { id: note.id } };
  } catch (error) { return toActionError(error); }
}

export async function updateNoteAction(
  noteId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const raw = {
      content: formData.get('content') as string | undefined,
      is_pinned: formData.has('is_pinned') ? formData.get('is_pinned') === 'true' : undefined,
    };

    const service = new NotesService(supabase);
    await service.updateNote(noteId, agencyId, userId, raw);

    const pathname = formData.get('pathname') as string;
    if (pathname) {
      revalidatePath(pathname);
    }
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function deleteNoteAction(
  noteId: string,
  pathname?: string
): Promise<ActionResult> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();
    const service = new NotesService(supabase);
    await service.deleteNote(noteId, agencyId, userId);

    if (pathname) {
      revalidatePath(pathname);
    }
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function pinNoteAction(
  noteId: string,
  isPinned: boolean,
  pathname?: string
): Promise<ActionResult> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();
    const service = new NotesService(supabase);
    await service.updateNote(noteId, agencyId, userId, { is_pinned: isPinned });

    if (pathname) {
      revalidatePath(pathname);
    }
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}
