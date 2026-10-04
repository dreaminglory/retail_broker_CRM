"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MemberService } from "@/domain/members/service";
import {
  updateMemberRoleSchema,
  deactivateMemberSchema,
  reactivateMemberSchema,
  inviteMemberSchema,
} from "@/domain/members/validation";

export async function updateMemberRole(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const rawData = {
    membershipId: formData.get("membershipId") as string,
    role: formData.get("role") as string,
  };

  const parsed = updateMemberRoleSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "Invalid role data" };
  }

  const memberService = new MemberService(supabase);

  try {
    await memberService.updateMemberRole(parsed.data.membershipId, parsed.data.role, user.id);
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to update member role" };
  }
}

export async function deactivateMember(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const rawData = {
    membershipId: formData.get("membershipId") as string,
  };

  const parsed = deactivateMemberSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  const memberService = new MemberService(supabase);

  try {
    await memberService.deactivateMember(parsed.data.membershipId, user.id);
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to deactivate member" };
  }
}

export async function reactivateMember(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const rawData = {
    membershipId: formData.get("membershipId") as string,
  };

  const parsed = reactivateMemberSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  const memberService = new MemberService(supabase);

  try {
    await memberService.reactivateMember(parsed.data.membershipId);
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to reactivate member" };
  }
}

export async function inviteMember(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const agencyId = formData.get("agencyId") as string;

  if (!email || !role || !agencyId) {
    return { error: "Missing required fields" };
  }

  const parsed = inviteMemberSchema.safeParse({ email, role });
  if (!parsed.success) {
    return { error: "Invalid data format" };
  }

  const memberService = new MemberService(supabase);

  try {
    await memberService.inviteMember(agencyId, parsed.data.email, parsed.data.role, user.id);
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to invite member" };
  }
}

export async function cancelInvitation(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const membershipId = formData.get("membershipId") as string;
  if (!membershipId) {
    return { error: "Missing membership ID" };
  }

  const memberService = new MemberService(supabase);

  try {
    // Fetch membership to verify it exists and is accessible
    const membership = await memberService["repo"].getMembership(membershipId);
    if (!membership) {
      return { error: "Membership not found or unauthorized" };
    }
    
    // Verify caller has permissions
    const { data: callerMembership } = await supabase
      .from("agency_memberships")
      .select("role")
      .eq("agency_id", membership.agency_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!callerMembership || !["owner", "manager"].includes(callerMembership.role)) {
      return { error: "Unauthorized to cancel invitations" };
    }

    if (membership.status !== "invited") {
      return { error: "Only pending invitations can be cancelled." };
    }

    // Use admin client to bypass missing DELETE policy
    const { createSupabaseAdmin } = await import("@/lib/supabase/server");
    const adminDb = await createSupabaseAdmin();
    const { error: deleteError } = await adminDb
      .from("agency_memberships")
      .delete()
      .eq("id", membershipId)
      .eq("status", "invited");

    if (deleteError) {
      throw new Error(`Failed to cancel invitation: ${deleteError.message}`);
    }

    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Failed to cancel invitation" };
  }
}
