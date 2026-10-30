"use server";

import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AgencyService } from "@/domain/agencies/service";
import { redirect } from "next/navigation";
import { toActionError } from "@/lib/actions";
import { DomainError } from "@/lib/errors";

export async function onboardingAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const agencyName = formData.get("agencyName") as string;
  if (!agencyName) {
    return toActionError(new DomainError("validation.name_required"));
  }

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return toActionError(new DomainError("errors.unauthorized"));
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
  } catch (err) {
    return toActionError(err);
  }
}
