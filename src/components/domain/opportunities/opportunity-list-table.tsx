"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Stage } from "@/domain/stages/types";
import { RequirementSummaryLine } from "@/components/domain/requirements/requirement-summary-line";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { StageBadge } from "./stage-badge";
import { ChevronRight, Briefcase, Calendar } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";

interface OpportunityListTableProps {
  opportunities: Opportunity[];
  /** Buyer and tenant deals' requirement summary lines by opportunity id, shown under the title. */
  requirementSummaries?: Record<string, string>;
  stages: Stage[];
  /** New matches by opportunity id, shown on the row (the new-matches smart list). */
  newMatches?: Record<string, number>;
  /** Owner display names by user id; shown as an initials avatar on the row. */
  brokerNames?: Map<string, string>;
  /** Inside a card that already has the border (the deals page): no border of its own. */
  embedded?: boolean;
}

export function OpportunityListTable({
  opportunities,
  requirementSummaries = {},
  stages,
  newMatches,
  brokerNames,
  embedded = false,
}: OpportunityListTableProps) {
  const t = useTranslations("OpportunityListTable");

  if (opportunities.length === 0) {
    return (
      <div className={cn("py-16 text-center", !embedded && "rounded-lg border border-dashed")}>
        <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("noOpportunities")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {t("noOpportunitiesDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border", !embedded && "rounded-lg border border-border bg-card")}>
      {opportunities.map((opp) => {
        const stage = stages.find((s) => s.id === opp.stage_id);
        const owner = opp.assigned_to ? brokerNames?.get(opp.assigned_to) : undefined;
        return (
          <OpportunityRow
            key={opp.id}
            opportunity={opp}
            stage={stage}
            requirementSummary={requirementSummaries[opp.id]}
            newMatches={newMatches?.[opp.id]}
            owner={owner}
          />
        );
      })}
    </div>
  );
}

function OpportunityRow({
  opportunity,
  stage,
  requirementSummary,
  newMatches,
  owner,
}: {
  opportunity: Opportunity;
  stage?: Stage;
  requirementSummary?: string;
  newMatches?: number;
  owner?: string;
}) {
  const format = useFormatter();
  const enums = useTranslations("Enums");
  const t = useTranslations("OpportunityListTable");

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <p className="truncate text-body-strong text-ink">{opportunity.title}</p>
          {stage && <StageBadge stage={stage} />}
          {opportunity.temperature === "hot" && <span title={enums("opportunityTemperature.hot")}>🔥</span>}
          {opportunity.temperature === "warm" && <span title={enums("opportunityTemperature.warm")}>⚡</span>}
          {opportunity.temperature === "cold" && <span title={enums("opportunityTemperature.cold")}>❄️</span>}
        </div>

        <RequirementSummaryLine summary={requirementSummary} className="mb-1" />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-small text-muted-foreground">
          <span>{enums(`opportunityType.${opportunity.type}`)}</span>

          {opportunity.next_action_at && (
            <span className="flex items-center gap-1 text-primary tabular-nums">
              <Calendar className="size-3" aria-hidden />
              {format.dateTime(new Date(opportunity.next_action_at), { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>

      {newMatches !== undefined && newMatches > 0 && (
        <Badge variant="secondary" className="shrink-0">
          {t("newMatches", { count: newMatches })}
        </Badge>
      )}

      {opportunity.expected_value && (
        <span className="shrink-0 text-body-strong text-ink tabular-nums">
          {format.number(opportunity.expected_value, {
            style: "currency",
            currency: opportunity.currency || "EUR",
            maximumFractionDigits: 0,
          })}
        </span>
      )}

      {owner && (
        <span
          title={owner}
          className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-accent text-small font-semibold text-primary sm:flex"
        >
          {initials(owner)}
        </span>
      )}

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
