/**
 * Profile domain types.
 * AD-023: User Profiles — synced from auth.users via database trigger.
 * Profiles are user-level (no agency_id) because identity transcends tenants.
 */

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  display_name: string;
}
