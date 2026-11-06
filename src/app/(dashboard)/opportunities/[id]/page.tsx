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
import { getLocale } from "next-intl/server";
import { OpportunityPropertyService } from "@/domain/opportunity-properties/service";
import { RequirementService } from "@/domain/requirements/service";
import { MatchingService } from "@/domain/matching/service";
import { PropertyMatchesSection, MATCH_PREVIEW_SIZE, parseMatchView } from "@/components/domain/matching/property-matches-section";
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
  const locale = (await getLocale()) as Locale;
  const hasRequirement = opportunity.type === "buyer" || opportunity.type === "tenant";
  const [stages, leadSources, contacts, tasks, timeline, brokers, settings, propertyLinks, requirement] = await Promise.all([
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
  ]);

  // Matches (spec: matching): only buyer and tenant deals that are still open.
  const view = parseMatchView(query);
  const showMatches = hasRequirement && (opportunity.status === "active" || opportunity.status === "nurture");
  const matches = showMatches && requirement
    ? await new MatchingService(supabase).forOpportunity(id, agencyId, locale, {
        includeLinked: view.linked,
        page: view.all ? view.page : 1,
        pageSize: view.all ? undefined : MATCH_PREVIEW_SIZE,
      })
    : { rows: [], total: 0, unlinked: 0, page: 1, pageSize: MATCH_PREVIEW_SIZE };
  const baseParams = Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) =>
      typeof value === "string" && !["matches", "matchesPage", "matchesLinked"].includes(key) ? [[key, value]] : []
    )
  );
  if (view.all) baseParams.matches = "all";
  if (view.linked) baseParams.matchesLinked = "1";
  if (view.all && view.page > 1) baseParams.matchesPage = String(view.page);

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
            showMatches ? (
              <PropertyMatchesSection
                opportunityType={opportunity.type}
                hasRequirement={!!requirement}
                matches={matches}
                view={view}
                baseParams={baseParams}
              />
            ) : null
          }
        />
      </div>
    </FreshNowProvider>
  );
}
