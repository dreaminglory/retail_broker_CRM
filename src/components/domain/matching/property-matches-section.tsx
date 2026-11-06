import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageInfo } from "@/lib/pagination";
import type { MatchPage, PropertyMatch } from "@/domain/matching/types";
import type { OpportunityType } from "@/domain/opportunities/types";
import { MatchRow } from "./match-row";

/** Rows shown before "Show all". */
export const MATCH_PREVIEW_SIZE = 10;

/** The section's view, read from `?matches=all`, `?matchesPage=` and `?matchesLinked=1`. */
export type MatchView = { all: boolean; page: number; linked: boolean };

export function parseMatchView(params: Record<string, string | string[] | undefined>): MatchView {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const page = Number(first(params.matchesPage));
  return {
    all: first(params.matches) === "all",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    linked: first(params.matchesLinked) === "1",
  };
}

type PropertyMatchesSectionProps = {
  opportunityId: string;
  opportunityType: OpportunityType;
  /** False when the deal has no requirement yet: the section asks for one. */
  hasRequirement: boolean;
  matches: MatchPage<PropertyMatch>;
  view: MatchView;
  /** The page's other search params, kept on every link of the section. */
  baseParams: Record<string, string>;
};

export function hrefWith(baseParams: Record<string, string>, changes: Record<string, string | null>) {
  const params = new URLSearchParams(baseParams);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return `${query ? `?${query}` : "?"}#opportunity-matches`;
}

/** The properties that fit a buyer or tenant deal, best first (spec: matching, Screens). */
export function PropertyMatchesSection({ opportunityId, opportunityType, hasRequirement, matches, view, baseParams }: PropertyMatchesSectionProps) {
  const t = useTranslations("matching");
  const format = useFormatter();
  const pager = view.all ? pageInfo(matches.page, matches.pageSize, matches.total) : null;
  const rows = view.all ? matches.rows : matches.rows.slice(0, MATCH_PREVIEW_SIZE);
  const linkClass = buttonVariants({ variant: "ghost", size: "sm" });

  return (
    <section id="opportunity-matches" className="rounded-lg border bg-card" aria-labelledby="opportunity-matches-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h3 id="opportunity-matches-title" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          {t("title")}
          {hasRequirement && matches.unlinked > 0 && <Badge variant="secondary">{t("newCount", { count: matches.unlinked })}</Badge>}
        </h3>
        {hasRequirement && (
          <Link
            href={hrefWith(baseParams, { matchesLinked: view.linked ? null : "1", matchesPage: null })}
            className={linkClass}
            scroll={false}
          >
            {t(view.linked ? "hideLinked" : "showLinked")}
          </Link>
        )}
      </div>

      {!hasRequirement ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
          <p className="text-sm text-muted-foreground">{t("noRequirement")}</p>
          <a href="#opportunity-requirement" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("addRequirement")}
          </a>
        </div>
      ) : matches.rows.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
          <p className="text-sm text-muted-foreground">{t(view.linked ? "emptyLinked" : "empty")}</p>
          <a href="#opportunity-requirement" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("editRequirement")}
          </a>
        </div>
      ) : (
        <>
          <ul className="divide-y">
            {rows.map((match) => (
              <MatchRow key={match.property_id} opportunityId={opportunityId} match={match} opportunityType={opportunityType} />
            ))}
          </ul>

          {!view.all && matches.total > MATCH_PREVIEW_SIZE && (
            <div className="border-t px-5 py-2">
              <Link href={hrefWith(baseParams, { matches: "all", matchesPage: null })} className={linkClass} scroll={false}>
                {t("showAll", { count: format.number(matches.total) })}
              </Link>
            </div>
          )}

          {pager && (
            <nav aria-label={t("pagerLabel")} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-2">
              <div className="flex items-center gap-3">
                <Link href={hrefWith(baseParams, { matches: null, matchesPage: null })} className={linkClass} scroll={false}>
                  {t("showFewer")}
                </Link>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {t("range", { from: format.number(pager.from), to: format.number(pager.to), total: format.number(pager.total) })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={hrefWith(baseParams, { matches: "all", matchesPage: pager.page - 1 <= 1 ? null : String(pager.page - 1) })}
                  aria-disabled={pager.page <= 1}
                  tabIndex={pager.page <= 1 ? -1 : undefined}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), pager.page <= 1 && "pointer-events-none opacity-50")}
                  scroll={false}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t("prev")}
                </Link>
                <span className="text-sm text-muted-foreground">{t("pageOf", { page: pager.page, pages: pager.totalPages })}</span>
                <Link
                  href={hrefWith(baseParams, { matches: "all", matchesPage: String(pager.page + 1) })}
                  aria-disabled={pager.page >= pager.totalPages}
                  tabIndex={pager.page >= pager.totalPages ? -1 : undefined}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), pager.page >= pager.totalPages && "pointer-events-none opacity-50")}
                  scroll={false}
                >
                  {t("next")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
