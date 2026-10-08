"use server";

import { revalidatePath } from 'next/cache';
import { NotesService } from '@/domain/notes/service';
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';

export async function createOpportunityNoteAction(
  opportunityId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, userId, agencyId } = await getAuthContext();

    const raw = {
      opportunity_id: opportunityId,
      content: formData.get('content') as string,
      is_pinned: formData.get('is_pinned') === 'true',
    };

    const service = new NotesService(supabase);
    const note = await service.createNote(agencyId, userId, raw);

    revalidatePath(`/opportunities/${opportunityId}`);
    return { success: true, data: { id: note.id } };
  } catch (error) { return toActionError(error); }
}
