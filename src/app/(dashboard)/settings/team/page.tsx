import { createSupabaseServer } from "@/lib/supabase/server";
import { MemberService } from "@/domain/members/service";
import { MemberList } from "@/components/domain/members/member-list";
import { redirect } from "next/navigation";

import { InviteDialog } from "@/components/domain/members/invite-dialog";

export default async function TeamSettingsPage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current user's role and agency
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return <div>No active membership found.</div>;
  }

  const memberService = new MemberService(supabase);
  const members = await memberService.getAgencyMembers(membership.agency_id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-sm text-muted-foreground">
            View and manage your agency&apos;s team members and their roles.
          </p>
        </div>
        {(membership.role === "owner" || membership.role === "manager") && (
          <InviteDialog agencyId={membership.agency_id} currentUserRole={membership.role} />
        )}
      </div>

      <MemberList 
        members={members} 
        currentUserId={user.id} 
        currentUserRole={membership.role} 
      />
    </div>
  );
}
