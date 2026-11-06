import { useTranslations } from "next-intl";
import { Check, CircleHelp, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchChip } from "@/domain/matching/criteria";

const STYLES: Record<MatchChip["result"], { icon: typeof Check; className: string }> = {
  match: { icon: Check, className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  close: { icon: Minus, className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  miss: { icon: X, className: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" },
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
