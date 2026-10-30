import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MemberRepository } from "@/domain/members/repository";
import { getExceptionDataAction } from "./actions";
import { ExceptionsPageClient } from "./exceptions-page-client";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("exceptions") };
}

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
    const t = await getTranslations("ExceptionsPage");
    return <div className="p-6">{t("loadFailed")}</div>;
  }

  const brokers = await new MemberRepository(supabase).getActiveBrokers(membership.agency_id);

  return <ExceptionsPageClient data={data} brokers={brokers} />;
}
