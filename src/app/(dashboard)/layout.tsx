import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar userRole={membership?.role ?? "broker"} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
