import { z } from 'zod';
import { nullableUuid } from '@/lib/validation';
import { normalizePhone, phoneValidationMessage } from '../contacts/phone';
import { normalizeContactMethodValue } from '../contacts/validation';
import type { Inquiry } from './types';

// ── Status transition map ──────────────────────────────────────────────────
// Defines which statuses can follow which (for service-layer enforcement).
export const INQUIRY_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ['contacted', 'converted', 'dismissed'],
  contacted: ['converted', 'dismissed'],
  converted: [],   // terminal — cannot revert
  dismissed: [],   // terminal — cannot revert
};

// ── Caller fields ──────────────────────────────────────────────────────────

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * E.164 like contact methods (C2). Omitted stays undefined, so partial updates leave it alone.
 * `storedPhone` passes as is: an old caller the backfill couldn't read mustn't block other edits.
 */
const callerPhoneSchema = (storedPhone: string | null = null) =>
  z
    .preprocess(emptyToNull, z.string().max(50).nullable().optional())
    .transform((value, ctx) => {
      if (!value || value === storedPhone) return value;
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: phoneValidationMessage() });
        // Not z.NEVER: an empty value would also trip requireCallerOrContent.
        return value;
      }
      return normalized;
    });

const callerEmailSchema = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().email('validation.invalid_email').nullable().optional()
);

type CallerContactMethod = { type: 'phone' | 'email'; value: string; label: null; is_primary: boolean };

/** The contact methods a caller's details become at conversion, normalised (C2). */
export function callerContactMethods(
  caller: Pick<Inquiry, 'caller_phone' | 'caller_email'>
): CallerContactMethod[] {
  const methods: CallerContactMethod[] = [];
  if (caller.caller_phone) {
    methods.push({
      type: 'phone',
      value: normalizeContactMethodValue('phone', caller.caller_phone),
      label: null,
      is_primary: true,
    });
  }
  if (caller.caller_email) {
    methods.push({
      type: 'email',
      value: normalizeContactMethodValue('email', caller.caller_email),
      label: null,
      is_primary: !caller.caller_phone,
    });
  }
  return methods;
}

/**
 * Whether an inquiry may be assigned to this user. Keeping a deactivated assignee is allowed, so
 * editing other fields doesn't force a reassign. `assigned_to` only references auth.users, so
 * nothing below this check stops a user from another agency being set.
 */
export function canAssignTo(
  assignedTo: string | null,
  currentAssignee: string | null,
  activeMemberIds: string[]
): boolean {
  return !assignedTo || assignedTo === currentAssignee || activeMemberIds.includes(assignedTo);
}

// ── Schemas ────────────────────────────────────────────────────────────────

function requireCallerOrContent(
  data: {
    caller_name?: string | null;
    caller_phone?: string | null;
    caller_email?: string | null;
    subject?: string | null;
    description?: string | null;
  },
  ctx: z.RefinementCtx
) {
  // Must have at least some identifying information about the caller
  const hasCallerInfo = data.caller_name || data.caller_phone || data.caller_email;
  const hasContent = data.subject || data.description;
  if (!hasCallerInfo && !hasContent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.inquiry_needs_info',
      path: ['caller_name'],
    });
  }
}

export const createInquirySchema = z
  .object({
    source_id: nullableUuid(),
    source_description: z.string().max(500).nullable().optional(),
    caller_name: z.string().max(200).nullable().optional(),
    caller_phone: callerPhoneSchema(),
    caller_email: callerEmailSchema,
    subject: z.string().max(500).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    external_ref: z.string().max(200).nullable().optional(),
    assigned_to: nullableUuid(),
    raw_payload: z.record(z.unknown()).optional().default({}),
  })
  .superRefine(requireCallerOrContent);

export const updateInquirySchema = z.object({
  source_id: nullableUuid(),
  source_description: z.string().max(500).nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  assigned_to: nullableUuid(),
  status: z.enum(['new', 'contacted', 'converted', 'dismissed']).optional(),
  dismissed_reason: z.string().max(1000).nullable().optional(),
  caller_name: z.string().max(200).nullable().optional(),
  caller_phone: callerPhoneSchema(),
  caller_email: callerEmailSchema,
  subject: z.string().max(500).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  external_ref: z.string().max(200).nullable().optional(),
});

/** What a person may change on an existing inquiry. raw_payload and received_at are never here. */
export const editInquirySchemaFor = (storedPhone: string | null) =>
  updateInquirySchema
    .pick({
      source_id: true,
      assigned_to: true,
      caller_name: true,
      caller_email: true,
      subject: true,
      description: true,
      external_ref: true,
    })
    .extend({ caller_phone: callerPhoneSchema(storedPhone) })
    .superRefine(requireCallerOrContent);

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
  opportunity_title: z.string().min(1, 'validation.opp_title_required').max(300),
  opportunity_type: z.enum(['buyer', 'seller', 'landlord', 'tenant']),
  stage_id: z.string().uuid('validation.stage_required'),
  assigned_to: nullableUuid(),
});

export type CreateInquirySchema = z.infer<typeof createInquirySchema>;
export type UpdateInquirySchema = z.infer<typeof updateInquirySchema>;
export type DismissInquirySchema = z.infer<typeof dismissInquirySchema>;
export type ConvertInquirySchema = z.infer<typeof convertInquirySchema>;
