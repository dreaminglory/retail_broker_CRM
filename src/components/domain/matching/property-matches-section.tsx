import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { MatchPage, PropertyMatch } from "@/domain/matching/types";
import type { OpportunityType } from "@/domain/opportunities/types";
import { LinkedToggle, MATCH_PREVIEW_SIZE, MatchListFooter } from "./match-list-controls";
import { DEAL_MATCH_KEYS, type MatchView } from "./match-params";
import { MatchRow } from "./match-row";

const ANCHOR = "opportunity-matches";

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

/** The properties that fit a buyer or tenant deal, best first (spec: matching, Screens). */
export function PropertyMatchesSection({ opportunityId, opportunityType, hasRequirement, matches, view, baseParams }: PropertyMatchesSectionProps) {
  const t = useTranslations("matching");
  const controls = { view, keys: DEAL_MATCH_KEYS, baseParams, anchor: ANCHOR };
  const rows = view.all ? matches.rows : matches.rows.slice(0, MATCH_PREVIEW_SIZE);

  return (
    <section id={ANCHOR} className="rounded-lg border bg-card" aria-labelledby="opportunity-matches-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h3 id="opportunity-matches-title" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          {t("title")}
          {hasRequirement && matches.unlinked > 0 && <Badge variant="secondary">{t("newCount", { count: matches.unlinked })}</Badge>}
        </h3>
        {hasRequirement && <LinkedToggle {...controls} />}
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
          <MatchListFooter {...controls} matches={matches} />
        </>
      )}
    </section>
  );
}
