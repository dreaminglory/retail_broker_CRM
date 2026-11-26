import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Placeholders for screens that are designed but not built (spec ui-bright, phase 4).
 * Rules: sample data from message keys, every control disabled, no queries. To remove a
 * placeholder, delete its route and its nav entry.
 */

/** The «Скоро» badge, for a nav entry or a section heading. */
export function ComingSoonBadge({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");
  return (
    <Badge variant="default" className={className}>
      {t("badge")}
    </Badge>
  );
}

/** "Not live yet — showing sample data". Static, so a note rather than a live region. */
export function ComingSoonBanner({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");
  return (
    <div
      role="note"
      className={cn("flex items-center gap-2 rounded-md border border-info-line bg-info-soft px-3 py-2 text-body text-ink", className)}
    >
      <Info className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">{t("banner")}</span>
      <ComingSoonBadge className="ml-auto" />
    </div>
  );
}

/** A control of a placeholder: looks like the real one and does nothing. */
export function ComingSoonControl({ children, ...props }: Omit<ComponentProps<typeof Button>, "disabled" | "onClick" | "type">) {
  return (
    <Button type="button" disabled {...props}>
      {children}
    </Button>
  );
}

/** A placeholder section: the banner above its sample content. */
export function ComingSoonSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <ComingSoonBanner className="mb-4" />
      {children}
    </section>
  );
}
