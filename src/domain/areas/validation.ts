import { z } from 'zod';

const areaName = z
  .string()
  .trim()
  .min(1, 'validation.name_required')
  .max(100, 'validation.name_too_long');

export const createAreaSchema = z.object({
  settlement_id: z.string().uuid('validation.settlement_required'),
  name: areaName,
});

export const updateAreaSchema = z.object({
  name: areaName.optional(),
  is_active: z.boolean().optional(),
});

export const reorderAreasSchema = z
  .array(z.object({ id: z.string().uuid(), sort_order: z.number().int().min(0) }))
  .max(500);

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type ReorderAreasInput = z.infer<typeof reorderAreasSchema>;
