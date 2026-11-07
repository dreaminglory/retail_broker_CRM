import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ListChecks, PartyPopper } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { queueStepHref } from "@/domain/smart-lists/queue";
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
import { QueueStepLink } from "@/components/domain/smart-lists/queue-bar";
import { ListPager } from "@/components/ui/list-pager";
import { InquiryList } from "@/components/domain/inquiries/inquiry-list";
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
  searchParams: Promise<{ scope?: string; page?: string; done?: string }>;
}) {
  const [{ id }, { scope, page, done }] = await Promise.all([params, searchParams]);

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
      actions={
        list.entity === "opportunity" && result && result.total > 0 ? (
          <QueueStepLink
            href={queueStepHref({ listId: list.id, dir: "next", pos: 0, scope: data.scope })}
            className={buttonVariants({ size: "sm" })}
          >
            <ListChecks className="h-4 w-4" aria-hidden />
            {t("smartLists.queue.workThrough")}
          </QueueStepLink>
        ) : null
      }
    />
  );

  return (
    <div className="mx-auto max-w-4xl">
      {header}
      {done === "1" && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PartyPopper className="h-4 w-4 text-emerald-600" aria-hidden />
            {t("smartLists.queue.doneTitle")}
          </p>
          <Link href={data.scope === "agency" ? "/lists?scope=agency" : "/lists"} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("smartLists.queue.backToLists")}
          </Link>
        </div>
      )}
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
      <InquiryList
        inquiries={rows}
        pageInfo={pageInfo(data.page, data.pageSize, total)}
        leadSources={leadSources}
        stages={stages}
        brokers={brokers}
        inactiveAssigneeNames={inactiveAssigneeNames}
        timeZone={settings.timezone}
        joinedDeals={joinedDeals}
      />
    </FreshNowProvider>
  );
}
