"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hrefWithParam } from "@/lib/url-state";
import { useRelativeTime } from "@/lib/i18n/use-relative-time";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { ActiveBroker } from "@/domain/members/types";

/**
 * The inquiries list (inquiries.png): source pill, caller, message line, status and age, assignee.
 * A row selects the inquiry into `?id=` (replace, not push); the panel shows it.
 */
export function InquiryRows({
  inquiries,
  selectedId,
  leadSources,
  brokers,
  inactiveAssigneeNames,
}: {
  inquiries: Inquiry[];
  selectedId: string | null;
  leadSources: LeadSource[];
  brokers: ActiveBroker[];
  inactiveAssigneeNames: Record<string, string>;
}) {
  const t = useTranslations("InquiryCard");
  const ago = useRelativeTime();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <ul className="divide-y divide-border">
      {inquiries.map((inquiry) => {
        const selected = inquiry.id === selectedId;
        const source = inquiry.source_id ? leadSources.find((s) => s.id === inquiry.source_id) : null;
        const caller = inquiry.caller_name || inquiry.caller_phone || inquiry.caller_email || t("unknownCaller");
        const assignee = inquiry.assigned_to
          ? brokers.find((b) => b.id === inquiry.assigned_to)?.display_name ?? inactiveAssigneeNames[inquiry.assigned_to]
          : undefined;
        const message = inquiry.subject || inquiry.description;
        return (
          <li key={inquiry.id}>
            <Link
              href={hrefWithParam(pathname, search, "id", inquiry.id)}
              replace
              scroll={false}
              aria-current={selected ? "true" : undefined}
              data-testid="inquiry-row"
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-l-2 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center sm:px-5",
                selected ? "border-l-primary bg-accent" : "border-l-transparent hover:bg-muted"
              )}
            >
              <span className="col-span-2 sm:col-span-1">
                {source ? (
                  <Badge variant="secondary" className="max-w-full truncate">
                    {source.name}
                  </Badge>
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body-strong text-ink">{caller}</span>
                {message && <span className="block truncate text-small text-muted-foreground">{message}</span>}
              </span>
              <span className="flex flex-col items-end gap-1 text-small text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Badge variant={inquiry.status === "new" ? "default" : "secondary"}>{t(`status.${inquiry.status}`)}</Badge>
                  <span className="whitespace-nowrap tabular-nums">{ago(inquiry.received_at)}</span>
                </span>
                {assignee && (
                  <span className="flex max-w-40 items-center gap-1 truncate">
                    <User className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{assignee}</span>
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
