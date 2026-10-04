import type { Profile } from "@/domain/profiles/types";

export type MemberRole = "owner" | "manager" | "broker";
export type MemberStatus = "active" | "invited" | "deactivated";

export interface AgencyMembership {
  id: string;
  user_id: string;
  agency_id: string;
  role: MemberRole;
  status: MemberStatus;
  invited_by: string | null;
  invitation_email: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyMember extends AgencyMembership {
  profile: Profile | null;
}

export interface ActiveBroker {
  id: string; // user_id
  display_name: string;
  email: string;
  role: MemberRole;
}
