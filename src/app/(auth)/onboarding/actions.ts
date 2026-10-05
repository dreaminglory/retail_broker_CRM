"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { AgencyService } from "@/domain/agencies/service";
import { redirect } from "next/navigation";

export async function onboardingAction(formData: FormData) {
  const agencyName = formData.get("agencyName") as string;
  if (!agencyName) {
    return { error: "Agency name is required" };
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if they already have an active membership
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    return { success: true };
  }

  try {
    await AgencyService.createWithOwner(agencyName);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
