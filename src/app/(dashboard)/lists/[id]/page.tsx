import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getAuthContext, type AuthContext } from "@/lib/actions";
import { pageInfo, parsePage } from "@/lib/pagination";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";
import { SmartListService, type ListPage } from "@/domain/smart-lists/service";
import { canSwitchListScope } from "@/domain/smart-lists/built-in";
import type { InquiryListRow, OpportunityListRow } from "@/domain/smart-lists/types";
import { StageRepository } from "@/domain/stages/repository";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { MemberRepository } from "@/domain/members/repository";
import { RequirementService } from "@/domain/requirements/service";
import { getAgencySettings } from "@/domain/agencies/settings";
import { OpportunityListTable } from "@/components/domain/opportunities/opportunity-list-table";
import { ListPageHeader } from "@/components/domain/smart-lists/list-page-header";
import { ListPager } from "@/components/ui/list-pager";
import { InquiriesPageClient } from "../../inquiries/inquiries-page-client";
import { loadInquiryRowContext } from "../../inquiries/inquiry-row-context";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("lists") };
}

export default async function SmartListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string; page?: string }>;
}) {
  const [{ id }, { scope, page }] = await Promise.all([params, searchParams]);

  // Only a missing session or membership means "sign in"; any other failure
  // reaches the error boundary.
  let ctx: AuthContext;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/login");
  }

  // Unknown, invisible (RLS) or agency-only for a broker: not found.
  const data = await new SmartListService(ctx.supabase).page(ctx, id, scope, parsePage(page));
  if (!data) notFound();

  const t = await getTranslations();
  const { list, result } = data;
  const name = list.kind === "built-in" ? t(list.list.nameKey as never) : list.list.name;
  const header = (
    <ListPageHeader
      listId={list.id}
      name={name}
      entity={list.entity}
      total={result?.total ?? null}
      scope={data.scope}
      showScopeToggle={list.kind === "built-in" && list.list.scope === "mine" && canSwitchListScope(ctx.role)}
    />
  );

  return (
    <div className="mx-auto max-w-4xl">
      {header}
      {!result ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t("smartLists.overview.stale")}
        </p>
      ) : result.total === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500/70" aria-hidden />
          <p className="text-sm font-medium">{t("smartLists.page.emptyTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("smartLists.page.emptyDesc")}</p>
        </div>
      ) : result.entity === "opportunity" ? (
        <OpportunityRows ctx={ctx} data={data} rows={result.rows} total={result.total} />
      ) : (
        <InquiryRows ctx={ctx} data={data} rows={result.rows} total={result.total} />
      )}
    </div>
  );
}

type RowsProps<Row> = { ctx: AuthContext; data: ListPage; rows: Row[]; total: number };

async function OpportunityRows({ ctx, data, rows, total }: RowsProps<OpportunityListRow>) {
  const locale = (await getLocale()) as Locale;
  const [stages, requirementSummaries] = await Promise.all([
    new StageRepository(ctx.supabase).findAll(ctx.agencyId),
    new RequirementService(ctx.supabase).getSummaries(rows, ctx.agencyId, locale),
  ]);
  const newMatches = Object.fromEntries(
    rows.flatMap((r) => (r.new_matches === null ? [] : [[r.id, r.new_matches]]))
  );

  return (
    <>
      <OpportunityListTable
        opportunities={rows}
        requirementSummaries={requirementSummaries}
        stages={stages}
        newMatches={newMatches}
      />
      <ListPager page={data.page} pageSize={data.pageSize} total={total} />
    </>
  );
}

/** Inquiry lists keep the inquiry list's row actions; each one refreshes the page (rule 8). */
async function InquiryRows({ ctx, data, rows, total }: RowsProps<InquiryListRow>) {
  const [leadSources, stages, brokers, settings] = await Promise.all([
    new LeadSourceRepository(ctx.supabase).findActive(ctx.agencyId),
    new StageRepository(ctx.supabase).findActive(ctx.agencyId),
    new MemberRepository(ctx.supabase).getActiveBrokers(ctx.agencyId),
    getAgencySettings(ctx.agencyId),
  ]);
  const { inactiveAssigneeNames, joinedDeals } = await loadInquiryRowContext(ctx.supabase, ctx.agencyId, rows, brokers);

  return (
    <FreshNowProvider now={new Date().toISOString()}>
      <InquiriesPageClient
        embedded
        inquiries={rows}
        pageInfo={pageInfo(data.page, data.pageSize, total)}
        leadSources={leadSources}
        stages={stages}
        brokers={brokers}
        inactiveAssigneeNames={inactiveAssigneeNames}
        initialSearch=""
        initialStatus="all"
        userRole={ctx.role}
        timeZone={settings.timezone}
        joinedDeals={joinedDeals}
      />
    </FreshNowProvider>
  );
}
