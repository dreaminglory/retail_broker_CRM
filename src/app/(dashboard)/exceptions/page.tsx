import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getExceptionDataAction } from "./actions";
import { ExceptionsPageClient } from "./exceptions-page-client";

export const metadata = {
  title: "Exceptions Dashboard | BrokerCRM",
  description: "Manager exception dashboard",
};

export default async function ExceptionsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch membership to get role and agency
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) redirect("/login");

  // Role guard: Only owners and managers
  if (!["owner", "manager"].includes(membership.role)) {
    redirect("/dashboard");
  }

  // Fetch all exception data for the dashboard
  const data = await getExceptionDataAction();
  if (!data) {
    return <div className="p-6">Failed to load exception data.</div>;
  }

  return <ExceptionsPageClient data={data} />;
}
