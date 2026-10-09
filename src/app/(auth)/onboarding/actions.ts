"use server";

import { cookies } from "next/headers";
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
    const cookieStore = await cookies();
    const locale = (cookieStore.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'bg');
    await AgencyService.createWithOwner(agencyName, locale);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
