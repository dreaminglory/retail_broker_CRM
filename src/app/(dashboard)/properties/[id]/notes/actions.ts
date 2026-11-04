"use server";

import { revalidatePath } from 'next/cache';
import { NotesService } from '@/domain/notes/service';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

export async function createPropertyNoteAction(
  propertyId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const note = await new NotesService(supabase).createNote(agencyId, userId, {
      property_id: propertyId,
      content: formData.get('content') as string,
      is_pinned: formData.get('is_pinned') === 'true',
    });

    revalidatePath(`/properties/${propertyId}`);
    return { success: true, data: { id: note.id } };
  } catch (error) { return toActionError(error); }
}
