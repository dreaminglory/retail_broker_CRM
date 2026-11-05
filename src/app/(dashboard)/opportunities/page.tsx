import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { RequirementService } from "@/domain/requirements/service";
import { createSupabaseServer } from "@/lib/supabase/server";
import { OpportunityService } from "@/domain/opportunities/service";
import { StageRepository } from "@/domain/stages/repository";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { MemberRepository } from "@/domain/members/repository";
import { OpportunitiesPageClient } from "./opportunities-page-client";
import type { OpportunityType } from "@/domain/opportunities/types";
import { PAGE_SIZE, loadPage, parsePage } from "@/lib/pagination";
import { parseOpportunityListFilters } from "@/domain/opportunities/validation";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("opportunities") };
}


interface SearchParams {
  search?: string;
  status?: "active" | "won" | "lost" | "nurture" | "archived" | "all";
  stage?: string;
  type?: OpportunityType | "all";
  broker?: string;
  temperature?: string;
  page?: string;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "active";
  const stage = params.stage ?? "all";
  const type = params.type ?? "all";
  const page = parsePage(params.page);
  const { assignedTo, temperature } = parseOpportunityListFilters(params);

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

  if (!agencyId) {
    const tErrors = await getTranslations("errors");
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted-foreground">
          {tErrors("noMembership")}
        </p>
      </div>
    );
  }

  const locale = (await getLocale()) as Locale;
  const pagedPromise = loadPage(page, PAGE_SIZE, (offset, limit) =>
    new OpportunityService(supabase).listPage(agencyId, {
      search: search || undefined,
      status: status === "all" ? "all" : status,
      stageId: stage === "all" ? undefined : stage,
      type: type === "all" ? "all" : type,
      assignedTo,
      temperature,
      limit,
      offset,
    })
  );

  // Fetch all required data in parallel; the rows' summary lines (FR-REQ-05) as soon as the page is in.
  const [paged, requirementSummaries, stages, leadSources, brokers] = await Promise.all([
    pagedPromise,
    pagedPromise.then((paged) => new RequirementService(supabase).getSummaries(paged.rows, agencyId, locale)),
    new StageRepository(supabase).findActive(agencyId),
    new LeadSourceRepository(supabase).findActive(agencyId),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <OpportunitiesPageClient
        opportunities={paged.rows}
        requirementSummaries={requirementSummaries}
        pageInfo={paged.info}
        stages={stages}
        leadSources={leadSources}
        brokers={brokers}
        initialSearch={search}
        initialStatus={status}
        initialStage={stage}
        initialType={type}
        initialBroker={assignedTo ?? "all"}
        initialTemperature={temperature ?? "all"}
      />
    </div>
  );
}
