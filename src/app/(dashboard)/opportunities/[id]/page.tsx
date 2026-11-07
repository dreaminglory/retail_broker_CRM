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
import { getLocale, getTranslations } from "next-intl/server";
import { SmartListService } from "@/domain/smart-lists/service";
import { resolveListScope } from "@/domain/smart-lists/built-in";
import { parseQueueView } from "@/domain/smart-lists/queue";
import { QueueBar } from "@/components/domain/smart-lists/queue-bar";
import { OpportunityPropertyService } from "@/domain/opportunity-properties/service";
import { RequirementService } from "@/domain/requirements/service";
import { MatchingService } from "@/domain/matching/service";
import { PropertyMatchesSection } from "@/components/domain/matching/property-matches-section";
import { MATCH_PREVIEW_SIZE } from "@/components/domain/matching/match-list-controls";
import { DEAL_MATCH_KEYS, matchBaseParams, parseMatchView } from "@/components/domain/matching/match-params";
import type { Locale } from "@/i18n/config";
import { OpportunityDetailClient } from "./opportunity-detail-client";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyId = membership?.agency_id ?? "";
  if (!agencyId) notFound();

  // Opened from a smart list: the queue bar (spec: smart-lists, rule 7). The list is only resolved
  // here, for its name and access; the steps run when they are clicked.
  const queue = parseQueueView(query, id);
  const queueListPromise = queue
    ? new SmartListService(supabase).resolve(
        { userId: user!.id, agencyId, role: membership?.role ?? "" },
        queue.listId,
        resolveListScope(membership?.role ?? "", queue.scope)
      )
    : Promise.resolve(null);

  // Fetch opportunity first to ensure it exists
  const opportunity = await new OpportunityService(supabase).getById(id, agencyId);
  if (!opportunity) notFound();

  // Fetch parallel dependencies
  const locale = (await getLocale()) as Locale;
  const hasRequirement = opportunity.type === "buyer" || opportunity.type === "tenant";
  // Matches (spec: matching): only buyer and tenant deals that are still open. A deal without a
  // requirement has no matches, so the database returns an empty page for it.
  const view = parseMatchView(query);
  const showMatches = hasRequirement && (opportunity.status === "active" || opportunity.status === "nurture");
  const [stages, leadSources, contacts, tasks, timeline, brokers, settings, propertyLinks, requirement, matches] = await Promise.all([
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
    new OpportunityPropertyService(supabase).listForOpportunity(id, agencyId, locale),
    // Seller and landlord deals have no requirement (rule 1).
    hasRequirement ? new RequirementService(supabase).getForOpportunity(id, agencyId, locale) : null,
    showMatches
      ? new MatchingService(supabase).forOpportunity(id, agencyId, locale, {
          includeLinked: view.linked,
          page: view.all ? view.page : 1,
          pageSize: view.all ? undefined : MATCH_PREVIEW_SIZE,
        })
      : null,
  ]);

  const baseParams = matchBaseParams(query, DEAL_MATCH_KEYS, view, matches?.page ?? 1);

  const queueList = await queueListPromise;
  const queueListName =
    queueList?.kind === "built-in" ? (await getTranslations())(queueList.list.nameKey as never) : queueList?.list.name ?? "";
  const queueBar =
    queue && queueList && queueList.entity === "opportunity" ? (
      <QueueBar
        listId={queueList.id}
        listName={queueListName}
        pos={queue.pos}
        total={queue.total}
        sortKey={queue.sortKey}
        scope={resolveListScope(membership?.role ?? "", queue.scope)}
      />
    ) : null;

  // A fresh `now` per render: relative times match between the server and hydration.
  return (
    <FreshNowProvider now={new Date().toISOString()}>
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
          propertyLinks={propertyLinks}
          requirement={requirement}
          matchesSection={
            matches ? (
              <PropertyMatchesSection
                opportunityId={id}
                opportunityType={opportunity.type}
                hasRequirement={!!requirement}
                matches={matches}
                view={view}
                baseParams={baseParams}
              />
            ) : null
          }
        />
        {queueBar}
      </div>
    </FreshNowProvider>
  );
}
