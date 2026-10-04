"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Stage } from "@/domain/stages/types";
import { StageBadge } from "@/components/domain/opportunities/stage-badge";
import { ChevronRight, Briefcase, Calendar } from "lucide-react";
import { format } from "date-fns";

interface LinkedOpportunitiesProps {
  opportunities: Opportunity[];
  stages: Stage[];
}

export function LinkedOpportunities({ opportunities, stages }: LinkedOpportunitiesProps) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Opportunity linking will appear here once opportunities are created.
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
  const formatter = new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: opportunity.currency || "BGN",
    maximumFractionDigits: 0,
  });

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="truncate text-sm font-semibold">{opportunity.title}</p>
          {stage && <StageBadge stage={stage} />}
          {opportunity.status !== "active" && (
            <Badge variant={opportunity.status === "won" ? "default" : "secondary"}>
              {opportunity.status === "won" && "🏆 Won"}
              {opportunity.status === "lost" && "❌ Lost"}
              {opportunity.status === "nurture" && "🌱 Nurture"}
              {opportunity.status === "archived" && "📦 Archived"}
            </Badge>
          )}
          {opportunity.status === "active" && opportunity.temperature === "hot" && <span title="Hot">🔥</span>}
          {opportunity.status === "active" && opportunity.temperature === "warm" && <span title="Warm">⚡</span>}
          {opportunity.status === "active" && opportunity.temperature === "cold" && <span title="Cold">❄️</span>}
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="capitalize">{opportunity.type}</span>
          
          {opportunity.expected_value && (
            <>
              <span>•</span>
              <span className="font-medium text-foreground">
                {formatter.format(opportunity.expected_value)}
              </span>
            </>
          )}

          {opportunity.next_action_at && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <Calendar className="h-3 w-3" />
                {format(new Date(opportunity.next_action_at), "MMM d")}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
