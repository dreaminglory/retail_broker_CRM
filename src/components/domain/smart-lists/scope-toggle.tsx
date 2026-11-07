import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ListScope } from "@/domain/smart-lists/types";

/** Mine / Agency for owners and managers, as on Today (AD-044). `basePath` gets `?scope=agency`. */
export function ScopeToggle({ scope, basePath }: { scope: ListScope; basePath: string }) {
  const t = useTranslations("smartLists.scope");
  return (
    <div role="group" aria-label={t("label")} className="inline-flex rounded-md border p-0.5 text-sm">
      {(["mine", "agency"] as const).map((option) => (
        <Link
          key={option}
          href={option === "agency" ? `${basePath}?scope=agency` : basePath}
          aria-current={scope === option ? "page" : undefined}
          className={cn(
            "rounded px-3 py-1 transition-colors",
            scope === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t(option)}
        </Link>
      ))}
    </div>
  );
}
