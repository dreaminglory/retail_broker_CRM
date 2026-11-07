import { z } from 'zod';
import { nullableUuid } from '@/lib/validation';

// ── Sub-schemas ────────────────────────────────────────────────────────────

export const opportunityTypeSchema = z.enum([
  'buyer',
  'seller',
  'landlord',
  'tenant',
]);

export const opportunityStatusSchema = z.enum([
  'active',
  'won',
  'lost',
  'nurture',
  'archived',
]);

export const temperatureSchema = z.enum(['hot', 'warm', 'cold']);

/** Where a deal's next action falls: the list filter and the smart list filter read the same states. */
export const nextActionStateSchema = z.enum(['none', 'overdue', 'today', 'upcoming']);
export type NextActionState = z.infer<typeof nextActionStateSchema>;

export const participantRoleSchema = z.enum([
  'buyer',
  'seller',
  'landlord',
  'tenant',
  'co_owner',
  'representative',
  'broker',
  'other',
]);

// ── Opportunity schemas ────────────────────────────────────────────────────

export const createOpportunitySchema = z.object({
  title: z
    .string()
    .min(1, 'validation.title_required')
    .max(300, 'validation.title_too_long'),
  type: opportunityTypeSchema,
  stage_id: z.string().uuid('validation.stage_required'),
  source_id: nullableUuid(),
  inquiry_id: nullableUuid(),
  primary_contact_id: nullableUuid(),
  assigned_to: nullableUuid(),
  temperature: temperatureSchema.optional().default('warm'),
  expected_value: z.number().positive().nullable().optional(),
  currency: z.string().length(3, 'validation.invalid_currency').optional().default('EUR'),
  notes: z.string().max(10000).nullable().optional(),
});

export const updateOpportunitySchema = z.object({
  title: z
    .string()
    .min(1, 'validation.title_required')
    .max(300, 'validation.title_too_long')
    .optional(),
  type: opportunityTypeSchema.optional(),
  stage_id: z.string().uuid().optional(),
  source_id: nullableUuid(),
  primary_contact_id: nullableUuid(),
  assigned_to: nullableUuid(),
  temperature: temperatureSchema.nullable().optional(),
  expected_value: z.number().positive().nullable().optional(),
  currency: z.string().length(3, 'validation.invalid_currency').optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export const closeOpportunitySchema = z
  .object({
    outcome: z.enum(['won', 'lost', 'nurture']),
    lost_reason: z.string().max(1000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // lost_reason is required when outcome is 'lost'
    if (data.outcome === 'lost' && !data.lost_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.lost_reason_required',
        path: ['lost_reason'],
      });
    }
  });

// ── Participant schemas ────────────────────────────────────────────────────

export const addParticipantSchema = z
  .object({
    contact_id: z.string().uuid().nullable().optional(),
    user_id: z.string().uuid().nullable().optional(),
    role: participantRoleSchema,
    notes: z.string().max(1000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.contact_id && !data.user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.participant_required',
        path: ['contact_id'],
      });
    }
  });

export type CreateOpportunitySchema = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunitySchema = z.infer<typeof updateOpportunitySchema>;
export type CloseOpportunitySchema = z.infer<typeof closeOpportunitySchema>;
export type AddParticipantSchema = z.infer<typeof addParticipantSchema>;

// ── List filters ───────────────────────────────────────────────────────────

/** Whole days as typed in the URL: digits only, 1–3650 (as the smart list filter allows). */
const untouchedDaysParamSchema = z
  .string()
  .regex(/^\d{1,4}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(3650));

/**
 * The opportunity list's URL filters: `?broker=`, `?temperature=`, and the smart-list ones
 * (spec: smart-lists, rule 3) `?source=<id>`, `?next=none|overdue|today|upcoming`,
 * `?untouched=<days>`, `?matches=new`. A value that doesn't parse (a stale link, a typo) means
 * "no filter" rather than an error or an empty list.
 */
export function parseOpportunityListFilters(params: {
  broker?: string;
  temperature?: string;
  source?: string;
  next?: string;
  untouched?: string;
  matches?: string;
}) {
  const broker = z.string().uuid().safeParse(params.broker);
  const temperature = temperatureSchema.safeParse(params.temperature);
  const source = z.string().uuid().safeParse(params.source);
  const next = nextActionStateSchema.safeParse(params.next);
  const untouched = untouchedDaysParamSchema.safeParse(params.untouched);
  return {
    assignedTo: broker.success ? broker.data : undefined,
    temperature: temperature.success ? temperature.data : undefined,
    sourceId: source.success ? source.data : undefined,
    nextAction: next.success ? next.data : undefined,
    noTouchDays: untouched.success ? untouched.data : undefined,
    hasNewMatches: params.matches === 'new',
  };
}
