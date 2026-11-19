import { z } from 'zod';
import { parseAgencyLocal } from '@/lib/time/agency-day';
import { nullableUuid } from '@/lib/validation';
import type { DuePreset } from '@/domain/tasks/reschedule';
import { ANSWERED_PRESETS, CALL_CHANNELS, CALL_RESULTS, RETRY_PRESETS } from './types';

/** What a call is logged against (rule 2): a deal, a contact or an inquiry, and the tapped task. */
export const callContextSchema = z
  .object({
    opportunity_id: nullableUuid(),
    contact_id: nullableUuid(),
    inquiry_id: nullableUuid(),
    task_id: nullableUuid(),
  })
  .refine((c) => Boolean(c.opportunity_id || c.contact_id || c.inquiry_id), { message: 'phoneLoop.errors.noContext' });

const PRESETS = [...new Set([...ANSWERED_PRESETS, ...RETRY_PRESETS])] as [DuePreset, ...DuePreset[]];

/**
 * The post-call prompt's input (spec phone-loop rules 5 and 6). A custom next-action date is
 * read in agency time, like every task due date.
 */
export function logCallSchema(timezone: string) {
  const next = z.union([
    z.object({ preset: z.enum(PRESETS) }).strict(),
    z
      .object({
        due_at: z
          .string()
          .refine((v) => parseAgencyLocal(v, timezone) !== null, { message: 'validation.invalid_date' })
          .transform((v) => parseAgencyLocal(v, timezone)!.toISOString()),
      })
      .strict(),
  ]);

  return z
    .object({
      context: callContextSchema,
      name: z.string().trim().min(1).max(200),
      channel: z.enum(CALL_CHANNELS),
      result: z.enum(CALL_RESULTS),
      outcome: z.string().trim().min(1, 'validation.outcome_required').max(5000, 'validation.outcome_too_long'),
      complete_task_id: nullableUuid(),
      next: next.nullable(),
      new_stage_id: nullableUuid(),
    })
    .superRefine((input, ctx) => {
      const allowed: readonly string[] = input.result === 'answered' ? ANSWERED_PRESETS : RETRY_PRESETS;
      const nextOk =
        input.next === null ||
        ('preset' in input.next ? allowed.includes(input.next.preset) : input.result === 'answered');
      if (!nextOk) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['next'], message: 'phoneLoop.errors.invalidNext' });
      if (input.new_stage_id && input.result !== 'answered') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['new_stage_id'], message: 'phoneLoop.errors.stageNeedsAnswer' });
      }
    });
}

export type LogCallSchema = z.infer<ReturnType<typeof logCallSchema>>;
