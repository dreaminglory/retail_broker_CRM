/**
 * Lead Source domain types.
 * AD-007: Fully configurable from Sprint 1.
 */

export type Channel =
  | 'portal'
  | 'referral'
  | 'website'
  | 'phone'
  | 'social'
  | 'email'
  | 'walk_in'
  | 'other';

export interface LeadSource {
  id: string;
  agency_id: string;
  name: string;
  channel: Channel;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new lead source. */
export interface CreateLeadSourceInput {
  name: string;
  channel: Channel;
  sort_order?: number;
}

/** Input for updating an existing lead source. */
export interface UpdateLeadSourceInput {
  name?: string;
  channel?: Channel;
  sort_order?: number;
  is_active?: boolean;
}
