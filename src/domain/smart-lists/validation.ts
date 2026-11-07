/**
 * Smart list filter shapes (spec: smart-lists, AD-062). The SQL list functions read the same
 * keys; these schemas are strict so nothing they would ignore is ever saved.
 */

import { z } from 'zod';
import { opportunityStatusSchema, opportunityTypeSchema, temperatureSchema } from '../opportunities/validation';
import type { ListFilter } from './types';

const uuid = z.string().uuid();

/** `me` is resolved to the viewer in SQL, so a shared "mine" list works for everyone. */
const assignedToSchema = z.union([z.literal('me'), z.literal('unassigned'), uuid]);

const searchSchema = z.string().trim().max(200);

export const opportunityListSortSchema = z.enum(['created_desc', 'last_touch_asc', 'next_action_asc']);
export const inquiryListSortSchema = z.enum(['received_asc', 'received_desc']);
export const nextActionStateSchema = z.enum(['none', 'overdue', 'today', 'upcoming']);

export const opportunityListFilterSchema = z
  .object({
    status: z.array(opportunityStatusSchema).optional(),
    type: z.array(opportunityTypeSchema).optional(),
    stage_id: z.array(uuid).optional(),
    temperature: z.array(temperatureSchema).optional(),
    assigned_to: assignedToSchema.optional(),
    source_id: z.array(uuid).optional(),
    next_action: nextActionStateSchema.optional(),
    no_touch_days: z.number().int().min(1).max(3650).optional(),
    has_new_matches: z.boolean().optional(),
    search: searchSchema.optional(),
    sort: opportunityListSortSchema.optional(),
  })
  .strict();

export const inquiryListFilterSchema = z
  .object({
    status: z.array(z.enum(['new', 'contacted', 'converted', 'dismissed'])).optional(),
    assigned_to: assignedToSchema.optional(),
    source_id: z.array(uuid).optional(),
    search: searchSchema.optional(),
    sort: inquiryListSortSchema.optional(),
  })
  .strict();

export type OpportunityListFilter = z.infer<typeof opportunityListFilterSchema>;
export type InquiryListFilter = z.infer<typeof inquiryListFilterSchema>;

export const listNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.name_required')
  .max(60, 'validation.name_too_long');

/**
 * A saved list's filter as stored. A shape that no longer parses gives `{ ok: false }`, and the
 * list shows "edit this list" instead of results (rule 5).
 */
export function parseStoredFilter(
  entity: string,
  filter: unknown
): { ok: true; filter: ListFilter } | { ok: false } {
  if (entity === 'opportunity') {
    const parsed = opportunityListFilterSchema.safeParse(filter);
    return parsed.success ? { ok: true, filter: { entity, filter: parsed.data } } : { ok: false };
  }
  if (entity === 'inquiry') {
    const parsed = inquiryListFilterSchema.safeParse(filter);
    return parsed.success ? { ok: true, filter: { entity, filter: parsed.data } } : { ok: false };
  }
  return { ok: false };
}
