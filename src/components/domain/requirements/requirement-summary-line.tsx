"use client";

import { useFormatter, useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import type { OpportunityType } from "@/domain/opportunities/types";
import type { Requirement } from "@/domain/requirements/types";
import { summarizeRequirement, summaryText } from "@/domain/requirements/summary";
import { cn } from "@/lib/utils";

type RequirementSummaryLineProps = {
  requirement: Requirement | undefined;
  opportunityType: OpportunityType;
  className?: string;
};

/** A deal's requirement as one line, for lists (FR-REQ-05); nothing when it has none. */
export function RequirementSummaryLine({ requirement, opportunityType, className }: RequirementSummaryLineProps) {
  const tools = {
    t: useTranslations("requirements"),
    enums: useTranslations("Enums"),
    format: useFormatter(),
  };
  const label = useTranslations("RequirementSection")("title");
  if (!requirement) return null;

  const text = summaryText(summarizeRequirement(requirement, opportunityType, tools));
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <ListChecks className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="truncate" title={text}>
        {text}
      </span>
    </p>
  );
}
