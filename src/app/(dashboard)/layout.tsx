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

  // First check if they have any pending invitations and activate them
  // (We use admin client because RLS might prevent users from updating their own status)
  const { createSupabaseAdmin } = await import("@/lib/supabase/server");
  const adminDb = await createSupabaseAdmin();
  
  const { data: pendingInvites } = await adminDb
    .from("agency_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "invited");

  if (pendingInvites && pendingInvites.length > 0) {
    for (const inv of pendingInvites) {
      await adminDb
        .from("agency_memberships")
        .update({ 
          status: "active",
          joined_at: new Date().toISOString()
        })
        .eq("id", inv.id);
    }
  }

  // Now fetch the active membership
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

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
