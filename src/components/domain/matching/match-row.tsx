import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { propertyCode, propertyHeadline } from "@/components/domain/properties/property-labels";
import { toChips } from "@/domain/matching/criteria";
import type { PropertyMatch } from "@/domain/matching/types";
import type { OpportunityType } from "@/domain/opportunities/types";
import { AddCandidateButton } from "./add-candidate-button";
import { MatchChips } from "./match-chips";

type MatchRowProps = {
  opportunityId: string;
  match: PropertyMatch;
  opportunityType: OpportunityType;
};

/** One property that fits the deal: what it is, what it costs, how well it fits and why. */
export function MatchRow({ opportunityId, match, opportunityType }: MatchRowProps) {
  const t = useTranslations("matching");
  const enums = useTranslations("Enums");
  const format = useFormatter();
  const code = propertyCode(match);
  const isPlot = match.property_type === "plot";
  const size = isPlot ? match.plot_m2 : match.area_m2;
  const location = [match.area_name, match.settlement_name].filter(Boolean).join(", ");
  const price = format.number(Number(match.price), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const details = [
    size != null
      ? t(isPlot ? "plotM2" : "areaM2", { value: format.number(Number(size)) })
      : t(isPlot ? "plotNotRecorded" : "areaNotRecorded"),
    location,
  ].filter(Boolean);

  return (
    <li className="space-y-2 px-5 py-3" data-testid="match-row">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-0.5">
          <Link
            href={`/properties/${match.property_id}`}
            className="flex flex-wrap items-center gap-2 hover:underline"
            aria-label={t("openProperty", { code })}
          >
            <span className="font-mono text-xs text-muted-foreground">{code}</span>
            <span className="text-sm font-medium">{propertyHeadline(enums, { type: match.property_type, rooms: match.rooms })}</span>
          </Link>
          <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{price}</span>
          {match.listing_status === "reserved" && <Badge variant="outline">{enums("listingStatus.reserved")}</Badge>}
          {match.link_status && <Badge variant="secondary">{enums(`propertyLinkStatus.${match.link_status}`)}</Badge>}
          <span className="text-xs font-semibold text-primary">{t("score", { score: match.score })}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <MatchChips chips={toChips(match.criteria, opportunityType)} />
        {!match.link_status && <AddCandidateButton
            opportunityId={opportunityId}
            propertyId={match.property_id}
            label={t("addCandidate")}
            ariaLabel={t("addCandidateFor", { code })}
          />}
      </div>
    </li>
  );
}
