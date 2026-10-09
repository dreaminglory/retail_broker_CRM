"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Opportunity, OpportunityWithDetails } from "@/domain/opportunities/types";
import type { Stage } from "@/domain/stages/types";
import { StageBadge } from "./stage-badge";
import { Building2, User, ChevronRight, Briefcase, Calendar } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";

interface OpportunityListTableProps {
  opportunities: Opportunity[];
  stages: Stage[];
}

export function OpportunityListTable({ opportunities, stages }: OpportunityListTableProps) {
  const t = useTranslations("OpportunityListTable");

  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center">
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
    <div className="rounded-lg border bg-card divide-y">
      {opportunities.map((opp) => {
        const stage = stages.find((s) => s.id === opp.stage_id);
        return (
          <OpportunityRow key={opp.id} opportunity={opp} stage={stage} />
        );
      })}
    </div>
  );
}

function OpportunityRow({ opportunity, stage }: { opportunity: Opportunity; stage?: Stage }) {
  const format = useFormatter();
  const enums = useTranslations("Enums");

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="truncate text-sm font-semibold">{opportunity.title}</p>
          {stage && <StageBadge stage={stage} />}
          {opportunity.temperature === "hot" && <span title="Hot">🔥</span>}
          {opportunity.temperature === "warm" && <span title="Warm">⚡</span>}
          {opportunity.temperature === "cold" && <span title="Cold">❄️</span>}
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{enums(`opportunityType.${opportunity.type}`)}</span>
          
          {opportunity.expected_value && (
            <>
              <span>•</span>
              <span className="font-medium text-foreground">
                {format.number(opportunity.expected_value, { style: "currency", currency: opportunity.currency || "EUR", maximumFractionDigits: 0 })}
              </span>
            </>
          )}

          {opportunity.next_action_at && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <Calendar className="h-3 w-3" />
                {format.dateTime(new Date(opportunity.next_action_at), { month: "short", day: "numeric" })}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
