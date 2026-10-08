"use server";

import { revalidatePath } from "next/cache";
import { MemberService } from "@/domain/members/service";
import { getAuthContext, toActionError, type ActionResult } from '@/lib/actions';
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
    if (!parsed.success) return toActionError(parsed.error);

    const memberService = new MemberService(ctx.supabase);
    await memberService.updateMemberRole(parsed.data.membershipId, parsed.data.role, ctx.userId);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function deactivateMember(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const rawData = {
      membershipId: formData.get("membershipId") as string,
    };

    const parsed = deactivateMemberSchema.safeParse(rawData);
    if (!parsed.success) return toActionError(parsed.error);

    const memberService = new MemberService(ctx.supabase);
    await memberService.deactivateMember(parsed.data.membershipId, ctx.userId);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
}

export async function reactivateMember(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await getAuthContext();

    const rawData = {
      membershipId: formData.get("membershipId") as string,
    };

    const parsed = reactivateMemberSchema.safeParse(rawData);
    if (!parsed.success) return toActionError(parsed.error);

    const memberService = new MemberService(ctx.supabase);
    await memberService.reactivateMember(parsed.data.membershipId);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
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
    if (!parsed.success) return toActionError(parsed.error);

    const memberService = new MemberService(ctx.supabase);
    await memberService.inviteMember(ctx, parsed.data.email, parsed.data.role);
    revalidatePath("/settings/team");
    return { success: true, data: undefined };
  } catch (error) { return toActionError(error); }
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
  } catch (error) { return toActionError(error); }
}
