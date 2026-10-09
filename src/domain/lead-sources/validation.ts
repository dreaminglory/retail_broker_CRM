import { z } from 'zod';
import type { Channel } from './types';

export const CHANNELS: Channel[] = [
  'portal',
  'referral',
  'website',
  'phone',
  'social',
  'email',
  'walk_in',
  'other',
];

export const channelSchema = z.enum([
  'portal',
  'referral',
  'website',
  'phone',
  'social',
  'email',
  'walk_in',
  'other',
]);

export const createLeadSourceSchema = z.object({
  name: z
    .string()
    .min(1, 'validation.name_required')
    .max(100, 'validation.name_too_long'),
  channel: channelSchema,
  sort_order: z.number().int().min(0).optional(),
});

export const updateLeadSourceSchema = z.object({
  name: z
    .string()
    .min(1, 'validation.name_required')
    .max(100, 'validation.name_too_long')
    .optional(),
  channel: channelSchema.optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type CreateLeadSourceSchema = z.infer<typeof createLeadSourceSchema>;
export type UpdateLeadSourceSchema = z.infer<typeof updateLeadSourceSchema>;
