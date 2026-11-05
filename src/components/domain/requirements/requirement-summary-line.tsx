"use client";

import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

type RequirementSummaryLineProps = {
  /** From `RequirementService.getSummaries`, in the request's locale. */
  summary: string | undefined;
  className?: string;
};

/** A deal's requirement as one line, for lists (FR-REQ-05); nothing when it has none. */
export function RequirementSummaryLine({ summary, className }: RequirementSummaryLineProps) {
  const t = useTranslations("RequirementSection");
  if (!summary) return null;

  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <ListChecks className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{t("title")}: </span>
      {/* line-clamp, not truncate: nowrap text would widen an auto-sized column (the contact page) to its length. */}
      <span className="line-clamp-1" title={summary}>
        {summary}
      </span>
    </p>
  );
}
