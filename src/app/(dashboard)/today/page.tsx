import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TaskService } from "@/domain/tasks/service";
import { InquiryService } from "@/domain/inquiries/service";
import { StageRepository } from "@/domain/stages/repository";
import { MemberRepository } from "@/domain/members/repository";
import { TodayPageClient } from "./today-page-client";
import { quickCompleteTaskAction } from "./actions";

export default async function TodayPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Resolve agency membership
  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) redirect("/login");

  const agencyId = membership.agency_id;
  const isManager = membership.role === "owner" || membership.role === "manager";
  const filterUserId = isManager ? undefined : user.id;
  const taskService = new TaskService(supabase);
  const inquiryService = new InquiryService(supabase);
  const stageRepo = new StageRepository(supabase);
  const memberRepo = new MemberRepository(supabase);

  // Fetch all Today Screen data in parallel
  const [overdue, dueToday, upcoming, atRisk, newInquiries, stages, brokers] =
    await Promise.all([
      taskService.listOverdue(agencyId, filterUserId),
      taskService.listDueToday(agencyId, filterUserId),
      taskService.listUpcoming(agencyId, filterUserId),
      taskService.listAtRisk(agencyId, filterUserId),
      inquiryService.list(agencyId, { status: "new", assignedTo: filterUserId }),
      stageRepo.findAll(agencyId),
      memberRepo.getActiveBrokers(agencyId),
    ]);

  return (
    <TodayPageClient
      overdue={overdue}
      dueToday={dueToday}
      upcoming={upcoming}
      atRisk={atRisk}
      newInquiries={newInquiries}
      stages={stages}
      brokers={brokers}
      completeAction={quickCompleteTaskAction}
    />
  );
}
