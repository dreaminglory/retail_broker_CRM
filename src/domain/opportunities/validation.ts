import { z } from 'zod';

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
    .min(1, 'Title is required')
    .max(300, 'Title must be 300 characters or fewer'),
  type: opportunityTypeSchema,
  stage_id: z.string().uuid('Stage is required'),
  source_id: z.string().uuid().nullable().optional(),
  inquiry_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  temperature: temperatureSchema.optional().default('warm'),
  expected_value: z.number().positive().nullable().optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional().default('BGN'),
  notes: z.string().max(10000).nullable().optional(),
});

export const updateOpportunitySchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(300, 'Title must be 300 characters or fewer')
    .optional(),
  type: opportunityTypeSchema.optional(),
  stage_id: z.string().uuid().optional(),
  source_id: z.string().uuid().nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  temperature: temperatureSchema.nullable().optional(),
  expected_value: z.number().positive().nullable().optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional(),
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
        message: 'Reason is required when closing as Lost',
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
        message: 'Either a contact or a user must be specified',
        path: ['contact_id'],
      });
    }
  });

export type CreateOpportunitySchema = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunitySchema = z.infer<typeof updateOpportunitySchema>;
export type CloseOpportunitySchema = z.infer<typeof closeOpportunitySchema>;
export type AddParticipantSchema = z.infer<typeof addParticipantSchema>;
