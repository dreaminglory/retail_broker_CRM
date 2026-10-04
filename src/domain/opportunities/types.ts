/**
 * Opportunity domain types.
 * AD-009: All four opportunity types from Sprint 1.
 */

export type OpportunityType = 'buyer' | 'seller' | 'landlord' | 'tenant';
export type OpportunityStatus = 'active' | 'won' | 'lost' | 'nurture' | 'archived';
export type Temperature = 'hot' | 'warm' | 'cold';

export type ParticipantRole =
  | 'buyer'
  | 'seller'
  | 'landlord'
  | 'tenant'
  | 'co_owner'
  | 'representative'
  | 'broker'
  | 'other';

export interface OpportunityParticipant {
  id: string;
  opportunity_id: string;
  agency_id: string;
  /** Null when the participant is an internal user. */
  contact_id: string | null;
  /** Null when the participant is an external contact. */
  user_id: string | null;
  role: ParticipantRole;
  notes: string | null;
  created_at: string;
}

export interface Opportunity {
  id: string;
  agency_id: string;
  title: string;
  type: OpportunityType;

  /** FK → stages. */
  stage_id: string;

  /** FK → lead_sources. */
  source_id: string | null;

  /** FK → inquiries. Immutable once set — preserves origin. */
  inquiry_id: string | null;

  /** FK → contacts. Primary contact for this opportunity. */
  primary_contact_id: string | null;

  /** FK → auth.users. Owning broker. */
  assigned_to: string | null;

  status: OpportunityStatus;
  temperature: Temperature | null;

  expected_value: number | null;
  currency: string;

  notes: string | null;

  /**
   * Denormalized from tasks: earliest pending task due_at.
   * Maintained by DB trigger sync_opportunity_next_action (FR-TSK-07).
   * NULL → no pending task → "at risk" in Today Screen (Sprint 2).
   */
  next_action_at: string | null;

  closed_at: string | null;
  lost_reason: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Opportunity with joined stage, source and participants. */
export interface OpportunityWithDetails extends Opportunity {
  participants: OpportunityParticipant[];
}

/** Input for creating a new opportunity. */
export interface CreateOpportunityInput {
  title: string;
  type: OpportunityType;
  stage_id: string;
  source_id?: string | null;
  inquiry_id?: string | null;
  primary_contact_id?: string | null;
  assigned_to?: string | null;
  temperature?: Temperature;
  expected_value?: number | null;
  currency?: string;
  notes?: string | null;
}

/** Input for updating an opportunity. */
export interface UpdateOpportunityInput {
  title?: string;
  type?: OpportunityType;
  stage_id?: string;
  source_id?: string | null;
  primary_contact_id?: string | null;
  assigned_to?: string | null;
  temperature?: Temperature | null;
  expected_value?: number | null;
  currency?: string;
  notes?: string | null;
}

/** Input for closing an opportunity. */
export interface CloseOpportunityInput {
  outcome: 'won' | 'lost' | 'nurture';
  lost_reason?: string | null;
}

/** Input for adding a participant. */
export interface AddParticipantInput {
  contact_id?: string | null;
  user_id?: string | null;
  role: ParticipantRole;
  notes?: string | null;
}
