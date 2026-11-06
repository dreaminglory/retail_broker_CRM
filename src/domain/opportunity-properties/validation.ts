import { z } from 'zod';
import type { PropertyLinkSource, PropertyLinkStatus } from './types';

/** Where a link came from (AD-060). `viewing` is set by the database, never by the app. */
export const LINK_SOURCES = ['manual', 'match', 'viewing'] as const satisfies readonly PropertyLinkSource[];

/** In the order a deal usually moves through them. */
export const PROPERTY_LINK_STATUSES = [
  'candidate',
  'viewed',
  'offered',
  'rejected',
  'selected',
] as const satisfies readonly PropertyLinkStatus[];

/** The sources the app may set; `viewing` is set by the database only. */
export const APP_LINK_SOURCES = ['manual', 'match'] as const satisfies readonly PropertyLinkSource[];

export const addCandidateSchema = z.object({
  opportunity_id: z.string().uuid(),
  property_id: z.string({ required_error: 'validation.property_required' }).uuid('validation.property_required'),
  source: z.enum(APP_LINK_SOURCES).default('manual'),
});

const rejectedReason = z.string().trim().max(500, 'validation.rejected_reason_too_long').nullish();

/** "Not suitable" on a match: the link is created as rejected, with an optional reason (AD-060). */
export const rejectFromMatchSchema = z
  .object({
    opportunity_id: z.string().uuid(),
    property_id: z.string({ required_error: 'validation.property_required' }).uuid('validation.property_required'),
    rejected_reason: rejectedReason,
  })
  .transform(({ rejected_reason, ...link }) => ({ ...link, rejected_reason: rejected_reason || null }));

/** Rule 6: any status may follow any other; a reason only on `rejected`, and optional there. */
export const setLinkStatusSchema = z
  .object({
    status: z.enum(PROPERTY_LINK_STATUSES),
    rejected_reason: rejectedReason,
  })
  .transform(({ status, rejected_reason }) => ({
    status,
    rejected_reason: status === 'rejected' && rejected_reason ? rejected_reason : null,
  }));

export type AddCandidateInput = z.input<typeof addCandidateSchema>;
export type RejectFromMatchInput = z.input<typeof rejectFromMatchSchema>;
export type SetLinkStatusInput = z.input<typeof setLinkStatusSchema>;
