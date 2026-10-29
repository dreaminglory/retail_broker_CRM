import { z } from 'zod';
import { parseAgencyLocal } from '@/lib/time/agency-day';
import { nullableUuid } from '@/lib/validation';
import { RESCHEDULE_PRESETS } from './reschedule';

// ── Task type enum ─────────────────────────────────────────────────────────
// AD-013: Task type categorization
export const TASK_TYPES = ['call', 'follow_up', 'viewing', 'meeting', 'email', 'other'] as const;

export const taskTypeSchema = z.enum(TASK_TYPES).nullable().optional();

// ── Due date ───────────────────────────────────────────────────────────────
// A `datetime-local` value has no offset, so it is read as agency time
// (Sprint 6.2), never as the server's timezone. '' clears the due date.

function agencyDateTimeSchema(timezone: string) {
  return z
    .string()
    .refine((val) => parseAgencyLocal(val, timezone) !== null, { message: 'validation.invalid_date' })
    .transform((val) => parseAgencyLocal(val, timezone)!.toISOString());
}

/** Optional due date; '' clears it. */
function dueAtSchema(timezone: string) {
  return z
    .string()
    .transform((val) => (val === '' ? null : val))
    .pipe(agencyDateTimeSchema(timezone).nullable())
    .nullable()
    .optional();
}

const titleSchema = z
  .string()
  .min(1, 'validation.title_required')
  .max(300, 'validation.title_too_long');

const outcomeSchema = z
  .string()
  .min(1, 'validation.outcome_required')
  .max(5000, 'validation.outcome_too_long');

// ── Cancel task (Sprint 6.2: optional reason) ──────────────────────────────

export const cancelTaskSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(5000, 'validation.outcome_too_long')
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
});

/**
 * Task schemas bound to the agency's timezone, which due dates are read in.
 * AD-014: on complete, next_task and new_stage_id are optional (soft enforcement).
 */
export function taskSchemas(timezone: string) {
  const create = z.object({
    opportunity_id: z.string().uuid().nullable().optional(),
    contact_id: z.string().uuid().nullable().optional(),
    title: titleSchema,
    description: z.string().max(5000).nullable().optional(),
    task_type: taskTypeSchema,
    due_at: dueAtSchema(timezone),
    assigned_to: nullableUuid(),
  });

  const update = z.object({
    title: titleSchema.optional(),
    description: z.string().max(5000).nullable().optional(),
    task_type: taskTypeSchema,
    due_at: dueAtSchema(timezone),
    assigned_to: nullableUuid(),
  });

  const completeWithNext = z.object({
    outcome: outcomeSchema,
    next_task: create.nullable().optional(),
    new_stage_id: z.string().uuid().nullable().optional(),
  });

  // Sprint 6.2: reschedule to a preset, or to an explicit due date (required here).
  const reschedulePreset = z.object({ preset: z.enum(RESCHEDULE_PRESETS) }).strict();
  const rescheduleDate = z.object({ due_at: agencyDateTimeSchema(timezone) }).strict();

  return { create, update, completeWithNext, reschedulePreset, rescheduleDate };
}

export type TaskSchemas = ReturnType<typeof taskSchemas>;
export type CreateTaskSchema = z.infer<TaskSchemas['create']>;
export type CompleteTaskWithNextSchema = z.infer<TaskSchemas['completeWithNext']>;
export type UpdateTaskSchema = z.infer<TaskSchemas['update']>;
