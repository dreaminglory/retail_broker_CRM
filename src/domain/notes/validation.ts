import { z } from 'zod';

// Trimmed first, so a note of only spaces or new lines is refused as blank.
const content = z.string().trim().min(1, 'validation.content_required');

export const createNoteSchema = z.object({
  contact_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  content,
  is_pinned: z.boolean().optional(),
}).refine((data) => data.contact_id || data.opportunity_id || data.property_id, {
  message: 'validation.linked_entity_required',
  path: ['contact_id'], // attach error to one of the fields
});

export const updateNoteSchema = z.object({
  content: content.optional(),
  is_pinned: z.boolean().optional(),
});
