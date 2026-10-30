"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { ExceptionsRepository } from "@/domain/exceptions/repository";
import type { ExceptionData } from "@/domain/exceptions/repository";

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
