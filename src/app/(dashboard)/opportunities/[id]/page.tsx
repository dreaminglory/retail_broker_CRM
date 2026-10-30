import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { OpportunityService } from "@/domain/opportunities/service";
import { StageRepository } from "@/domain/stages/repository";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { ContactService } from "@/domain/contacts/service";
import { TaskService } from "@/domain/tasks/service";
import { TimelineService } from "@/domain/timeline/service";
import { MemberRepository } from "@/domain/members/repository";
import { getAgencySettings } from "@/domain/agencies/settings";
import { OpportunityDetailClient } from "./opportunity-detail-client";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyId = membership?.agency_id ?? "";
  if (!agencyId) notFound();

  // Fetch opportunity first to ensure it exists
  const opportunity = await new OpportunityService(supabase).getById(id, agencyId);
  if (!opportunity) notFound();

  // Fetch parallel dependencies
  const [stages, leadSources, contacts, tasks, timeline, brokers, settings] = await Promise.all([
    new StageRepository(supabase).findActive(agencyId),
    new LeadSourceRepository(supabase).findActive(agencyId),
    // Only the contacts this opportunity links to; pickers search the agency on demand.
    new ContactService(supabase).getByIds(
      [
        ...new Set(
          [opportunity.primary_contact_id, ...opportunity.participants.map((p) => p.contact_id)].filter(
            (id): id is string => !!id
          )
        ),
      ],
      agencyId
    ),
    new TaskService(supabase).list(agencyId, { opportunityId: id }),
    new TimelineService(supabase).getOpportunityTimeline(id, agencyId),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
    getAgencySettings(agencyId),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <OpportunityDetailClient
        opportunity={opportunity}
        stages={stages}
        leadSources={leadSources}
        contacts={contacts}
        brokers={brokers}
        tasks={tasks}
        timeline={timeline}
        currentUserId={user?.id}
        timeZone={settings.timezone}
      />
    </div>
  );
}
