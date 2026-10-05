import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, UpdateProfileInput } from './types';

/**
 * Profile repository — database access layer for user profiles.
 * AD-023: Profiles are user-level (no agency_id scoping).
 * RLS ensures any authenticated user can SELECT, only owner can UPDATE.
 */
export class ProfileRepository {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Get a single profile by user ID.
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }
    return data as Profile;
  }

  /**
   * Get multiple profiles by user IDs (batch resolution for timelines).
   * Returns a Map<userId, Profile> for O(1) lookup.
   */
  async getProfilesByIds(userIds: string[]): Promise<Map<string, Profile>> {
    if (userIds.length === 0) return new Map();

    // Deduplicate IDs
    const uniqueIds = [...new Set(userIds)];

    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .in('id', uniqueIds);

    if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);

    const map = new Map<string, Profile>();
    (data ?? []).forEach((profile) => {
      map.set((profile as Profile).id, profile as Profile);
    });
    return map;
  }

  /**
   * Update a profile (display_name, avatar_url).
   * RLS ensures only the profile owner can call this.
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const { data, error } = await this.db
      .from('profiles')
      .update({
        display_name: input.display_name,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update profile: ${error.message}`);
    return data as Profile;
  }

  /**
   * Update a user's locale.
   */
  async updateLocale(userId: string, locale: string): Promise<Profile> {
    const { data, error } = await this.db
      .from('profiles')
      .update({ locale })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update locale: ${error.message}`);
    return data as Profile;
  }

  /**
   * Get all profiles for members of a given agency.
   * Joins agency_memberships → profiles to get team members.
   */
  async getAgencyMemberProfiles(agencyId: string): Promise<Profile[]> {
    const { data: memberships, error: memberError } = await this.db
      .from('agency_memberships')
      .select('user_id')
      .eq('agency_id', agencyId)
      .eq('status', 'active');

    if (memberError) throw new Error(`Failed to fetch members: ${memberError.message}`);

    const userIds = (memberships ?? []).map((m) => m.user_id as string);
    if (userIds.length === 0) return [];

    const { data, error } = await this.db
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (error) throw new Error(`Failed to fetch member profiles: ${error.message}`);
    return (data ?? []) as Profile[];
  }
}
