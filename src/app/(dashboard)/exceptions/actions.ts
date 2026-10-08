"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { ExceptionsRepository } from "@/domain/exceptions/repository";
import type { ExceptionData } from "@/domain/exceptions/repository";
import { revalidatePath } from "next/cache";

import { getAgencySettings } from "@/domain/agencies/settings";

/** Gets all exception data for the dashboard. Requires manager/owner role. */
export async function getExceptionDataAction(): Promise<ExceptionData | null> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || !["owner", "manager"].includes(membership.role)) {
    return null; // Unauthorized
  }

  const settings = await getAgencySettings(membership.agency_id);
  const repo = new ExceptionsRepository(supabase);
  return repo.getDashboardData(membership.agency_id, settings.timezone);
}

export async function reassignInquiryAction(inquiryId: string, assignedTo: string) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || !["owner", "manager"].includes(membership.role)) {
    throw new Error("Unauthorized: Must be a manager or owner to reassign inquiries from the dashboard.");
  }

  const { error } = await supabase
    .from("inquiries")
    .update({ assigned_to: assignedTo })
    .eq("id", inquiryId)
    .eq("agency_id", membership.agency_id);

  if (error) throw new Error(`Failed to reassign inquiry: ${error.message}`);

  revalidatePath("/exceptions");
  revalidatePath("/inquiries");
}
