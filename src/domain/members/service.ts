import { DomainError, rpcFailure } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemberRepository } from "./repository";
import type { AgencyMember, MemberRole } from "./types";
import { getAppUrl } from "@/lib/app-url";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { AuthContext } from "@/lib/actions";
import { DEFAULT_AGENCY_TIMEZONE } from "@/lib/time/agency-day";


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
    if (!membership) throw new DomainError('errors.not_found');

    // Rule: if demoting an owner, ensure they are not the last owner
    if (membership.role === "owner" && newRole !== "owner") {
      await this.ensureAnotherActiveOwnerExists(membership.agency_id, membershipId);
    }

    await this.repo.updateMemberRole(membershipId, newRole);
  }

  async deactivateMember(membershipId: string, currentUserId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new DomainError('errors.not_found');

    // Rule: no self-deactivation
    if (membership.user_id === currentUserId) {
      throw new DomainError('errors.members.deactivate_self');
    }

    // Rule: if deactivating an owner, ensure they are not the last owner
    if (membership.role === "owner") {
      await this.ensureAnotherActiveOwnerExists(membership.agency_id, membershipId);
    }

    await this.repo.updateMemberStatus(membershipId, "deactivated");
  }

  async reactivateMember(membershipId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new DomainError('errors.not_found');

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
      throw new DomainError('errors.members.already_member');
    }

    const appUrl = getAppUrl();
    if (!appUrl) {
      throw new DomainError('errors.members.invite_failed', 'NEXT_PUBLIC_APP_URL is not set');
    }

    const adminDb = createSupabaseAdmin();
    const { data, error } = await adminDb.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_by: ctx.userId,
        agency_id: ctx.agencyId,
      },
      redirectTo: `${appUrl}/auth/callback?next=/update-password`,
    });

    if (error) {
      throw new DomainError('errors.members.invite_failed', `Failed to invite user: ${error.message}`);
    }

    if (!data.user) {
      throw new DomainError('errors.members.invite_failed_no_user');
    }

    await this.repo.createInvitation(ctx.agencyId, email, role, data.user.id, ctx.userId);
  }

  /**
   * Sends a pending invitation again (AD-061). The claim comes first: it checks the caller's
   * agency and role and allows one send per 5 minutes, so two clicks can't both send. Only then
   * is the email sent, with the same data and link as the first one.
   */
  async resendInvitation(
    ctx: AuthContext,
    membershipId: string,
    timeZone: string = DEFAULT_AGENCY_TIMEZONE
  ): Promise<void> {
    // Checked before the claim, so a missing URL doesn't use up the cooldown.
    const appUrl = getAppUrl();
    if (!appUrl) {
      throw new DomainError('errors.members.invite_failed', 'NEXT_PUBLIC_APP_URL is not set');
    }

    const { data, error } = await this.db.rpc('claim_invitation_resend', { p_membership_id: membershipId });
    if (error) {
      if (error.message === 'errors.members.resend_too_soon') {
        throw new DomainError(error.message, error.message, { time: formatClockTime(error.details, timeZone) });
      }
      throw rpcFailure(error);
    }

    const claim = data as { email: string | null };
    if (!claim.email) {
      throw new DomainError('errors.members.invite_failed', 'The invitation has no email address');
    }

    const { error: sendError } = await createSupabaseAdmin().auth.admin.inviteUserByEmail(claim.email, {
      data: {
        invited_by: ctx.userId,
        agency_id: ctx.agencyId,
      },
      redirectTo: `${appUrl}/auth/callback?next=/update-password`,
    });
    if (sendError) {
      // The cooldown stands: a retry works after 5 minutes.
      throw new DomainError('errors.members.invite_failed', `Failed to resend invitation: ${sendError.message}`);
    }
  }

  async cancelInvitation(ctx: AuthContext, membershipId: string): Promise<void> {
    const membership = await this.repo.getMembership(membershipId);
    if (!membership) throw new DomainError('errors.not_found');
    if (membership.status !== "invited") throw new DomainError('errors.members.only_pending_cancel');

    await this.repo.deleteInvitation(membershipId);
  }

  private async ensureAnotherActiveOwnerExists(agencyId: string, excludingMembershipId: string): Promise<void> {
    const members = await this.repo.getAgencyMembers(agencyId);
    const otherActiveOwners = members.filter(
      (m) => m.role === "owner" && m.status === "active" && m.id !== excludingMembershipId
    );
    if (otherActiveOwners.length === 0) {
      throw new DomainError('errors.members.last_owner');
    }
  }
}

/** The wall-clock time of an instant in the agency's timezone, as "HH:mm" (empty if it can't be read). */
function formatClockTime(iso: string | null | undefined, timeZone: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date);
}
