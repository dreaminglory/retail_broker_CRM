"use server";

import { revalidatePath } from "next/cache";
import { MemberService } from "@/domain/members/service";
import { getAuthContext, type ActionResult } from "@/lib/actions";
import {
  updateMemberRoleSchema,
  deactivateMemberSchema,
  reactivateMemberSchema,
  inviteMemberSchema,
} from "@/domain/members/validation";
import { DomainError } from "@/lib/errors";

export async function updateMemberRole(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const rawData = {
      membershipId: formData.get("membershipId") as string,
      role: formData.get("role") as string,
    };

    const parsed = updateMemberRoleSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: "Invalid role data" };
    }

    const memberService = new MemberService(ctx.supabase);
    await memberService.updateMemberRole(parsed.data.membershipId, parsed.data.role, ctx.userId);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update member role" };
  }
}

export async function deactivateMember(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const rawData = {
      membershipId: formData.get("membershipId") as string,
    };

    const parsed = deactivateMemberSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: "Invalid data" };
    }

    const memberService = new MemberService(ctx.supabase);
    await memberService.deactivateMember(parsed.data.membershipId, ctx.userId);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to deactivate member" };
  }
}

export async function reactivateMember(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const rawData = {
      membershipId: formData.get("membershipId") as string,
    };

    const parsed = reactivateMemberSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: "Invalid data" };
    }

    const memberService = new MemberService(ctx.supabase);
    await memberService.reactivateMember(parsed.data.membershipId);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to reactivate member" };
  }
}

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const email = formData.get("email") as string;
    const role = formData.get("role") as string;

    if (!email || !role) {
      return { success: false, error: "Missing required fields" };
    }

    const parsed = inviteMemberSchema.safeParse({ email, role });
    if (!parsed.success) {
      return { success: false, error: "Invalid data format" };
    }

    const memberService = new MemberService(ctx.supabase);
    await memberService.inviteMember(ctx, parsed.data.email, parsed.data.role);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof DomainError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to invite member" };
  }
}

export async function cancelInvitation(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const membershipId = formData.get("membershipId") as string;
    if (!membershipId) {
      return { success: false, error: "Missing membership ID" };
    }

    const memberService = new MemberService(ctx.supabase);
    await memberService.cancelInvitation(ctx, membershipId);
    
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof DomainError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to cancel invitation" };
  }
}
