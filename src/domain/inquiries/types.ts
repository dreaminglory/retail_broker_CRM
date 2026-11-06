/**
 * Inquiry domain types.
 * Inquiries are immutable inbound events — never deleted after creation (domain rule).
 */

export type InquiryStatus = 'new' | 'contacted' | 'converted' | 'dismissed';

export interface Inquiry {
  id: string;
  agency_id: string;

  /** FK → lead_sources. Null if source is unknown. */
  source_id: string | null;
  source_description: string | null;

  /** FK → contacts. Null until matched/created. */
  contact_id: string | null;

  /** FK → opportunities. Null until converted. */
  opportunity_id: string | null;

  /** FK → auth.users. Null until assigned. */
  assigned_to: string | null;

  status: InquiryStatus;

  caller_name: string | null;
  caller_phone: string | null;
  caller_email: string | null;
  subject: string | null;
  description: string | null;

  /** Original source payload preserved verbatim (FR-INQ-10). */
  raw_payload: Record<string, unknown>;

  /** External ID from portal or third-party system (FR-INQ-12). */
  external_ref: string | null;

  dismissed_reason: string | null;
  received_at: string;

  /** When the inquiry joined an existing deal (AD-061). Null if it never joined one. */
  joined_at: string | null;

  created_by: string | null;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Input for manually creating an inquiry. */
export interface CreateInquiryInput {
  source_id?: string | null;
  source_description?: string | null;
  caller_name?: string | null;
  caller_phone?: string | null;
  caller_email?: string | null;
  subject?: string | null;
  description?: string | null;
  external_ref?: string | null;
  assigned_to?: string | null;
  raw_payload?: Record<string, unknown>;
}

/** Input for updating mutable inquiry fields. */
export interface UpdateInquiryInput {
  source_id?: string | null;
  source_description?: string | null;
  contact_id?: string | null;
  opportunity_id?: string | null;
  assigned_to?: string | null;
  status?: InquiryStatus;
  dismissed_reason?: string | null;
  caller_name?: string | null;
  caller_phone?: string | null;
  caller_email?: string | null;
  subject?: string | null;
  description?: string | null;
  external_ref?: string | null;
}

/** An open deal a repeat caller's inquiry can join (AD-061). */
export type JoinableOpportunity = {
  id: string;
  title: string;
  type: 'buyer' | 'seller' | 'landlord' | 'tenant';
  status: 'active' | 'nurture';
  stage_name: string;
  assigned_to: string | null;
  owner_name: string | null;
  next_action_at: string | null;
};
