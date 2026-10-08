import { z } from 'zod';

export const createNoteSchema = z.object({
  contact_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  content: z.string().min(1, 'validation.content_required'),
  is_pinned: z.boolean().optional(),
}).refine((data) => data.contact_id || data.opportunity_id, {
  message: 'validation.linked_entity_required',
  path: ['contact_id'], // attach error to one of the fields
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'validation.content_required').optional(),
  is_pinned: z.boolean().optional(),
});
