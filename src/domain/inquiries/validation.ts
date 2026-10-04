import { z } from 'zod';

// ── Status transition map ──────────────────────────────────────────────────
// Defines which statuses can follow which (for service-layer enforcement).
export const INQUIRY_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'converted', 'dismissed'],
  contacted: ['converted', 'dismissed'],
  converted: [],   // terminal — cannot revert
  dismissed: [],   // terminal — cannot revert
};

// ── Schemas ────────────────────────────────────────────────────────────────

export const createInquirySchema = z
  .object({
    source_id: z.string().uuid().nullable().optional(),
    source_description: z.string().max(500).nullable().optional(),
    caller_name: z.string().max(200).nullable().optional(),
    caller_phone: z.string().max(50).nullable().optional(),
    caller_email: z.string().email('Invalid email').nullable().optional(),
    subject: z.string().max(500).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    external_ref: z.string().max(200).nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    raw_payload: z.record(z.unknown()).optional().default({}),
  })
  .superRefine((data, ctx) => {
    // Must have at least some identifying information about the caller
    const hasCallerInfo =
      data.caller_name || data.caller_phone || data.caller_email;
    const hasContent = data.subject || data.description;
    if (!hasCallerInfo && !hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Provide at least caller information (name, phone, or email) or a subject/description',
        path: ['caller_name'],
      });
    }
  });

export const updateInquirySchema = z.object({
  source_id: z.string().uuid().nullable().optional(),
  source_description: z.string().max(500).nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  status: z.enum(['new', 'contacted', 'converted', 'dismissed']).optional(),
  dismissed_reason: z.string().max(1000).nullable().optional(),
  caller_name: z.string().max(200).nullable().optional(),
  caller_phone: z.string().max(50).nullable().optional(),
  caller_email: z.string().email('Invalid email').nullable().optional(),
  subject: z.string().max(500).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

export const dismissInquirySchema = z.object({
  dismissed_reason: z.string().max(1000).nullable().optional(),
});

/** Schema for converting an inquiry to an opportunity. */
export const convertInquirySchema = z.object({
  /** Existing contact to link — mutually exclusive with create_contact. */
  contact_id: z.string().uuid().optional(),
  /** New contact to create from inquiry data. */
  create_contact: z
    .object({
      type: z.enum(['person', 'organization']),
      first_name: z.string().max(100).nullable().optional(),
      last_name: z.string().max(100).nullable().optional(),
      company_name: z.string().max(200).nullable().optional(),
    })
    .optional(),
  opportunity_title: z.string().min(1, 'Opportunity title is required').max(300),
  opportunity_type: z.enum(['buyer', 'seller', 'landlord', 'tenant']),
  stage_id: z.string().uuid('Stage is required'),
  assigned_to: z.string().uuid().nullable().optional(),
});

export type CreateInquirySchema = z.infer<typeof createInquirySchema>;
export type UpdateInquirySchema = z.infer<typeof updateInquirySchema>;
export type DismissInquirySchema = z.infer<typeof dismissInquirySchema>;
export type ConvertInquirySchema = z.infer<typeof convertInquirySchema>;
