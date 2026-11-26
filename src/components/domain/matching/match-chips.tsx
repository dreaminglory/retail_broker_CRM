import { useTranslations } from "next-intl";
import { Check, CircleHelp, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchChip } from "@/domain/matching/criteria";

const STYLES: Record<MatchChip["result"], { icon: typeof Check; className: string }> = {
  match: { icon: Check, className: "border-success/30 bg-success-soft text-success" },
  close: { icon: Minus, className: "border-warning/30 bg-warning-soft text-warning-ink" },
  miss: { icon: X, className: "border-danger/30 bg-danger-soft text-danger" },
  unknown: { icon: CircleHelp, className: "border-border bg-muted text-muted-foreground" },
};

/** One chip per criterion the requirement sets: label, result and a must-have mark. */
export function MatchChips({ chips }: { chips: MatchChip[] }) {
  const t = useTranslations();
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const { icon: Icon, className } = STYLES[chip.result];
        const label = t(chip.key as never);
        const result = t(`matching.result.${chip.result}` as never);
        return (
          <li
            key={chip.key}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", className)}
            title={chip.must ? `${label}: ${result}, ${t("matching.mustHave")}` : `${label}: ${result}`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            <span>{label}</span>
            {chip.must && <span aria-hidden>*</span>}
            <span className="sr-only">
              {result}
              {chip.must ? `, ${t("matching.mustHave")}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
