import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CallIntentProvider } from "@/components/domain/calls/call-intent-provider";
import { getAgencySettings } from "@/domain/agencies/settings";

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

  // Now fetch the active membership
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  // The post-call prompt offers "today 18:00" by the agency's clock, not the browser's.
  const { timezone } = await getAgencySettings(membership.agency_id);

  return (
    <CallIntentProvider timeZone={timezone}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar userRole={membership?.role ?? "broker"} />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden w-full max-w-full">
          <Header userRole={membership?.role ?? "broker"} />
          <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </CallIntentProvider>
  );
}
