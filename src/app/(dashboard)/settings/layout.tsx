import { createSupabaseServer } from "@/lib/supabase/server";
import { SettingsSidebar } from "./settings-sidebar";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function SettingsLayout({ children }: SettingsLayoutProps) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let role = "broker";
  if (user) {
    const { data: membership } = await supabase
      .from("agency_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (membership) {
      role = membership.role;
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto w-full">
      <SettingsSidebar userRole={role} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
