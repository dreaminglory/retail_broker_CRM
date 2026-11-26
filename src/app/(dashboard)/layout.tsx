import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CallIntentProvider } from "@/components/domain/calls/call-intent-provider";
import { getAgencySettings } from "@/domain/agencies/settings";
import { getTranslations } from "next-intl/server";
import type { ShellUser } from "@/components/layout/shell-types";
import type { MemberRole } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Automatically accept any pending invitations using the secure RPC
  await supabase.rpc('accept_pending_invitations');

  // Now fetch the active membership, with the agency's name for the sidebar
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role, agencies(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  // The post-call prompt offers "today 18:00" by the agency's clock, not the browser's.
  const { timezone } = await getAgencySettings(membership.agency_id);

  const t = await getTranslations("header");
  const agency = membership.agencies as unknown as { name: string } | null;
  const agencyName = agency?.name ?? t("myAgency");
  const shellUser: ShellUser = {
    fullName: (user.user_metadata?.full_name as string | undefined) || user.email || "",
    email: user.email ?? "",
    role: (membership.role as MemberRole) ?? "broker",
  };

  return (
    <CallIntentProvider timeZone={timezone}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar user={shellUser} agencyName={agencyName} />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden w-full max-w-full">
          <Header user={shellUser} agencyName={agencyName} />
          <main className="relative flex-1 overflow-y-auto bg-background p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </CallIntentProvider>
  );
}
