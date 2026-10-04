import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgencyMember, AgencyMembership, MemberRole, MemberStatus } from "./types";
import { ProfileRepository } from "../profiles/repository";

export class MemberRepository {
  private readonly profileRepo: ProfileRepository;

  constructor(private readonly db: SupabaseClient) {
    this.profileRepo = new ProfileRepository(db);
  }

  /**
   * Gets all agency members (memberships joined with profiles) for the given agency.
   */
  async getAgencyMembers(agencyId: string): Promise<AgencyMember[]> {
    const { data: memberships, error } = await this.db
      .from("agency_memberships")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch agency members: ${error.message}`);
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    const userIds = memberships.map((m) => m.user_id).filter(Boolean) as string[];
    const profilesMap = await this.profileRepo.getProfilesByIds(userIds);

    return (memberships as AgencyMembership[]).map((m) => ({
      ...m,
      profile: m.user_id ? profilesMap.get(m.user_id) ?? null : null,
    }));
  }

  /**
   * Updates a member's role.
   */
  async updateMemberRole(membershipId: string, role: MemberRole): Promise<void> {
    const { error } = await this.db
      .from("agency_memberships")
      .update({ role })
      .eq("id", membershipId);

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`);
    }
  }

  /**
   * Updates a member's status (e.g. deactivation, reactivation).
   */
  async updateMemberStatus(membershipId: string, status: MemberStatus): Promise<void> {
    const { error } = await this.db
      .from("agency_memberships")
      .update({ status })
      .eq("id", membershipId);

    if (error) {
      throw new Error(`Failed to update member status: ${error.message}`);
    }
  }

  /**
   * Gets a single membership by ID
   */
  async getMembership(membershipId: string): Promise<AgencyMembership | null> {
    const { data, error } = await this.db
      .from("agency_memberships")
      .select("*")
      .eq("id", membershipId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch membership: ${error.message}`);
    }

    return data as AgencyMembership;
  }

  /**
   * Creates an invitation membership.
   */
  async createInvitation(
    agencyId: string,
    email: string,
    role: MemberRole,
    userId: string,
    invitedBy: string
  ): Promise<AgencyMembership> {
    const { data, error } = await this.db
      .from("agency_memberships")
      .insert({
        agency_id: agencyId,
        user_id: userId,
        role: role,
        status: "invited",
        invitation_email: email.toLowerCase(),
        invited_by: invitedBy,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    return data as AgencyMembership;
  }

  /**
   * Deletes an invitation membership.
   */
  async deleteInvitation(membershipId: string): Promise<void> {
    const { error } = await this.db
      .from("agency_memberships")
      .delete()
      .eq("id", membershipId)
      .eq("status", "invited");

    if (error) {
      throw new Error(`Failed to cancel invitation: ${error.message}`);
    }
  }

  /**
   * Gets all active brokers (including managers/owners who act as brokers)
   * for the given agency, mapped to a simplified interface for dropdowns.
   */
  async getActiveBrokers(agencyId: string): Promise<{ id: string; display_name: string; email: string; role: MemberRole }[]> {
    const { data: memberships, error } = await this.db
      .from("agency_memberships")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("status", "active");

    if (error) {
      throw new Error(`Failed to fetch active brokers: ${error.message}`);
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    const userIds = memberships.map((m) => m.user_id).filter(Boolean) as string[];
    const profilesMap = await this.profileRepo.getProfilesByIds(userIds);

    const brokers = (memberships as AgencyMembership[]).map((m) => {
      const profile = m.user_id ? profilesMap.get(m.user_id) : null;
      return {
        id: m.user_id,
        display_name: profile?.display_name || "Unknown Member",
        email: profile?.email || "",
        role: m.role,
      };
    });

    return brokers.sort((a, b) => a.display_name.localeCompare(b.display_name));
  }
}
