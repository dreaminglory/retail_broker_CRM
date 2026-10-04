import { z } from 'zod';
import type { Contact } from './types';
import { normalizePhone, phoneValidationMessage } from './phone';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates the `display_name` value stored in the DB.
 * - person: "First Last" (handles partial names)
 * - organization: company_name
 * See FR-CON-09, AD-008.
 */
export function generateDisplayName(
  type: 'person' | 'organization',
  opts: { first_name?: string | null; last_name?: string | null; company_name?: string | null }
): string {
  if (type === 'organization') {
    return (opts.company_name ?? '').trim() || 'Unnamed Organization';
  }
  const parts = [opts.first_name, opts.last_name].filter(Boolean).join(' ').trim();
  return parts || 'Unnamed Contact';
}

// ── Phone value schema ─────────────────────────────────────────────────────
// AD-012: E.164 enforced in Sprint 1 (reverses AD-010).
// Accepts any common Bulgarian format; normalizes to +359XXXXXXXXX on save.



// ── Contact method schemas ─────────────────────────────────────────────────

export const contactMethodTypeSchema = z.enum([
  'phone',
  'email',
  'viber',
  'whatsapp',
  'other',
]);

/**
 * Discriminated schema: validation rules differ by method type.
 *  - phone / viber / whatsapp → E.164 normalization (AD-012)
 *  - email                    → email format check
 *  - other                    → free text
 */
export const contactMethodSchema = z
  .object({
    type: contactMethodTypeSchema,
    value: z.string().min(1, 'Value is required').max(200),
    label: z.string().max(50).nullable().default(null),
    is_primary: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'phone' || data.type === 'viber' || data.type === 'whatsapp') {
      const normalized = normalizePhone(data.value);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: phoneValidationMessage(),
          path: ['value'],
        });
      }
    }
    if (data.type === 'email') {
      const emailResult = z.string().email('Invalid email address').safeParse(data.value);
      if (!emailResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid email address',
          path: ['value'],
        });
      }
    }
  });

/**
 * Normalizes the `value` field of a contact method before saving to the DB.
 * Call this in the Server Action before inserting/updating contact_methods.
 * Returns the normalized value (E.164 for phone types, lowercase for email).
 */
export function normalizeContactMethodValue(
  type: string,
  value: string
): string {
  if (type === 'phone' || type === 'viber' || type === 'whatsapp') {
    return normalizePhone(value) ?? value;
  }
  if (type === 'email') {
    return value.toLowerCase().trim();
  }
  return value.trim();
}

// ── Contact schemas ────────────────────────────────────────────────────────

/** Used when creating a new contact (create form). */
export const createContactSchema = z
  .object({
    type: z.enum(['person', 'organization']),
    first_name: z.string().max(100).nullable().optional(),
    last_name: z.string().max(100).nullable().optional(),
    company_name: z.string().max(200).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    contact_methods: z.array(contactMethodSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'person') {
      if (!data.first_name && !data.last_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Person must have at least a first or last name',
          path: ['first_name'],
        });
      }
    }
    if (data.type === 'organization') {
      if (!data.company_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Organization name is required',
          path: ['company_name'],
        });
      }
    }
  });

/** Used when editing an existing contact. */
export const updateContactSchema = z
  .object({
    type: z.enum(['person', 'organization']).optional(),
    first_name: z.string().max(100).nullable().optional(),
    last_name: z.string().max(100).nullable().optional(),
    company_name: z.string().max(200).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'person') {
      if (data.first_name === null && data.last_name === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Person must have at least a first or last name',
          path: ['first_name'],
        });
      }
    }
    if (data.type === 'organization' && data.company_name !== undefined) {
      if (!data.company_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Organization name is required',
          path: ['company_name'],
        });
      }
    }
  });

/**
 * Used when adding a single contact method from the detail page.
 * Applies the same phone/email validation as contactMethodSchema.
 */
export const addContactMethodSchema = z
  .object({
    type: contactMethodTypeSchema,
    value: z.string().min(1, 'Value is required').max(200),
    label: z.string().max(50).nullable().default(null),
    is_primary: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'phone' || data.type === 'viber' || data.type === 'whatsapp') {
      if (!normalizePhone(data.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: phoneValidationMessage(),
          path: ['value'],
        });
      }
    }
    if (data.type === 'email') {
      if (!z.string().email().safeParse(data.value).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid email address',
          path: ['value'],
        });
      }
    }
  });

export type CreateContactSchema = z.infer<typeof createContactSchema>;
export type UpdateContactSchema = z.infer<typeof updateContactSchema>;
export type AddContactMethodSchema = z.infer<typeof addContactMethodSchema>;
export type ContactMethodSchema = z.infer<typeof contactMethodSchema>;
