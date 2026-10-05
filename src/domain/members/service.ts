import type { SupabaseClient } from "@supabase/supabase-js";
import { MemberRepository } from "./repository";
import type { AgencyMember, MemberRole } from "./types";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { AuthContext } from "@/lib/actions";
import { DomainError } from "@/lib/errors";

export class MemberService {
  private readonly repo: MemberRepository;

  constructor(private readonly db: SupabaseClient) {
    this.repo = new MemberRepository(db);
  }

  async getAgencyMembers(agencyId: string): Promise<AgencyMember[]> {
    return this.repo.getAgencyMembers(agencyId);
  }

  async updateMemberRole(membershipId: string, newRole: MemberRole, currentUserId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new Error("Membership not found.");

    // Rule: if demoting an owner, ensure they are not the last owner
    if (membership.role === "owner" && newRole !== "owner") {
      await this.ensureAnotherActiveOwnerExists(membership.agency_id, membershipId);
    }

    await this.repo.updateMemberRole(membershipId, newRole);
  }

  async deactivateMember(membershipId: string, currentUserId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new Error("Membership not found.");

    // Rule: no self-deactivation
    if (membership.user_id === currentUserId) {
      throw new Error("You cannot deactivate your own account.");
    }

    // Rule: if deactivating an owner, ensure they are not the last owner
    if (membership.role === "owner") {
      await this.ensureAnotherActiveOwnerExists(membership.agency_id, membershipId);
    }

    await this.repo.updateMemberStatus(membershipId, "deactivated");
  }

  async reactivateMember(membershipId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new Error("Membership not found.");

    await this.repo.updateMemberStatus(membershipId, "active");
  }

  async inviteMember(ctx: AuthContext, email: string, role: MemberRole): Promise<void> {
    if (ctx.role === 'manager' && role !== 'broker') {
      throw new DomainError('members.inviteForbidden', 'Managers can only invite brokers.');
    }

    const members = await this.repo.getAgencyMembers(ctx.agencyId);
    
    const existing = members.find(m => 
      m.invitation_email?.toLowerCase() === email.toLowerCase() || 
      m.profile?.email?.toLowerCase() === email.toLowerCase()
    );
    
    if (existing) {
      throw new Error("User is already a member or has been invited.");
    }

    const adminDb = createSupabaseAdmin();
    const { data, error } = await adminDb.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_by: ctx.userId,
        agency_id: ctx.agencyId,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`,
    });

    if (error) {
      throw new Error(`Failed to invite user: ${error.message}`);
    }

    if (!data.user) {
      throw new Error("Failed to invite user: No user returned from Supabase.");
    }

    await this.repo.createInvitation(ctx.agencyId, email, role, data.user.id, ctx.userId);
  }

  async cancelInvitation(ctx: AuthContext, membershipId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new Error("Membership not found.");
    if (membership.status !== "invited") throw new Error("Only pending invitations can be cancelled.");

    await this.repo.deleteInvitation(membershipId);
  }

  private async ensureAnotherActiveOwnerExists(agencyId: string, excludingMembershipId: string): Promise<void> {
    const members = await this.repo.getAgencyMembers(agencyId);
    const otherActiveOwners = members.filter(
      (m) => m.role === "owner" && m.status === "active" && m.id !== excludingMembershipId
    );
    if (otherActiveOwners.length === 0) {
      throw new Error("Cannot perform this action. The agency must have at least one active owner.");
    }
  }
}
