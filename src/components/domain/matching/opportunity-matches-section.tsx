import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MatchPage, OpportunityMatch } from "@/domain/matching/types";
import { LinkedToggle, MATCH_PREVIEW_SIZE, MatchListFooter } from "./match-list-controls";
import { PROPERTY_MATCH_KEYS, type MatchView } from "./match-params";
import { OpportunityMatchRow } from "./opportunity-match-row";

const ANCHOR = "property-matches";

type OpportunityMatchesSectionProps = {
  propertyId: string;
  /** What the property's open listings are for: sale → buyers, rent → tenants. */
  offerTypes: ("sale" | "rent")[];
  matches: MatchPage<OpportunityMatch>;
  view: MatchView;
  /** The page's other search params, kept on every link of the section. */
  baseParams: Record<string, string>;
};

/** The buyer and tenant deals that fit a property with an open listing (spec: matching, Screens). */
export function OpportunityMatchesSection({ propertyId, offerTypes, matches, view, baseParams }: OpportunityMatchesSectionProps) {
  const t = useTranslations("matching");
  const controls = { view, keys: PROPERTY_MATCH_KEYS, baseParams, anchor: ANCHOR };
  const rows = view.all ? matches.rows : matches.rows.slice(0, MATCH_PREVIEW_SIZE);
  const mixed = offerTypes.length > 1;
  const title = mixed ? "dealsTitleBoth" : offerTypes[0] === "rent" ? "dealsTitleRent" : "dealsTitleSale";

  return (
    <section id={ANCHOR} className="rounded-lg border bg-card" aria-labelledby="property-matches-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 id="property-matches-title" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-4 w-4" />
          {t(title)}
          {matches.unlinked > 0 && (
            <Badge variant="secondary" className="normal-case tracking-normal">
              {t("newCount", { count: matches.unlinked })}
            </Badge>
          )}
        </h2>
        <LinkedToggle {...controls} />
      </div>

      {matches.rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t(view.linked ? "dealsEmptyLinked" : "dealsEmpty")}</p>
      ) : (
        <>
          <ul className="divide-y">
            {rows.map((match) => (
              <OpportunityMatchRow key={match.opportunity_id} propertyId={propertyId} match={match} showType={mixed} />
            ))}
          </ul>
          <MatchListFooter {...controls} matches={matches} />
        </>
      )}
    </section>
  );
}
