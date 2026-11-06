import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { toChips } from "@/domain/matching/criteria";
import type { OpportunityMatch } from "@/domain/matching/types";
import { AddCandidateButton } from "./add-candidate-button";
import { MatchChips } from "./match-chips";

type OpportunityMatchRowProps = {
  propertyId: string;
  match: OpportunityMatch;
  /** Shown when the list mixes buyers and tenants (a property listed for sale and for rent). */
  showType: boolean;
};

/** One buyer or tenant deal that fits the property: who, how well and why. */
export function OpportunityMatchRow({ propertyId, match, showType }: OpportunityMatchRowProps) {
  const t = useTranslations("matching");
  const enums = useTranslations("Enums");

  return (
    <li className="space-y-2 px-5 py-3" data-testid="match-row">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-0.5">
          <Link href={`/opportunities/${match.opportunity_id}`} className="flex flex-wrap items-center gap-2 hover:underline">
            <span className="text-sm font-medium">{match.opportunity_title}</span>
            {showType && <span className="text-xs text-muted-foreground">{enums(`opportunityType.${match.opportunity_type}`)}</span>}
            {match.opportunity_status === "nurture" && <Badge variant="outline">{enums("opportunityStatus.nurture")}</Badge>}
          </Link>
          <p className="text-xs text-muted-foreground">
            {[match.contact_name, match.broker_name ? t("broker", { name: match.broker_name }) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {match.listing_status === "reserved" && <Badge variant="outline">{enums("listingStatus.reserved")}</Badge>}
          {match.link_status && <Badge variant="secondary">{enums(`propertyLinkStatus.${match.link_status}`)}</Badge>}
          <span className="text-xs font-semibold text-primary">{t("score", { score: match.score })}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <MatchChips chips={toChips(match.criteria, match.opportunity_type)} />
        {!match.link_status && (
          <AddCandidateButton
            opportunityId={match.opportunity_id}
            propertyId={propertyId}
            label={t("addToDeal")}
            ariaLabel={t("addToDealFor", { title: match.opportunity_title })}
          />
        )}
      </div>
    </li>
  );
}
