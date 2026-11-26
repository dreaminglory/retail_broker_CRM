"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryCard } from "@/components/domain/inquiries/inquiry-card";
import { hrefWithParam } from "@/lib/url-state";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { InquiryHandlers } from "./inquiry-actions";

/**
 * The selected inquiry (inquiries.png's right panel; below 1024 px the page shows it alone): the
 * card with its contact links and actions menu, the caller's message, and Convert as the view's
 * one main action. Only data the page already loads.
 */
export function InquiryPanel({
  inquiry,
  leadSources,
  brokers,
  inactiveAssigneeNames,
  joinedDeal,
  timeZone,
  handlers,
}: {
  inquiry: Inquiry;
  leadSources: LeadSource[];
  brokers: ActiveBroker[];
  inactiveAssigneeNames: Record<string, string>;
  joinedDeal?: { id: string; title: string };
  timeZone: string;
  handlers: InquiryHandlers;
}) {
  const t = useTranslations("InquiryCard");
  const tPage = useTranslations("InquiriesPage");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const open = inquiry.status === "new" || inquiry.status === "contacted";

  return (
    <section
      aria-label={inquiry.caller_name || inquiry.caller_phone || inquiry.caller_email || t("unknownCaller")}
      data-testid="inquiry-panel"
      className="overflow-hidden rounded-lg border border-border bg-surface"
    >
      {/* Phone: back to the list (the list is hidden while one is open). */}
      <Link
        href={hrefWithParam(pathname, search, "id", null)}
        replace
        scroll={false}
        className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-small text-primary hover:underline lg:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {tPage("viewAllBtn")}
      </Link>

      <InquiryCard
        inquiry={inquiry}
        leadSources={leadSources}
        brokers={brokers}
        inactiveAssigneeNames={inactiveAssigneeNames}
        joinedDeal={joinedDeal}
        timeZone={timeZone}
        flat
        {...handlers}
      />

      {inquiry.description && (
        <div className="px-4 pb-4">
          <blockquote className="whitespace-pre-wrap rounded-lg border border-info-line bg-info-soft px-4 py-3 text-body text-ink [overflow-wrap:anywhere]">
            {inquiry.description}
          </blockquote>
        </div>
      )}

      {open && (
        <div className="border-t border-border p-4">
          <Button emphasis="action" className="w-full" onClick={() => handlers.onConvert(inquiry)}>
            <ArrowUpRight className="size-4" aria-hidden />
            {t("convertToOpportunity")}
          </Button>
        </div>
      )}
    </section>
  );
}
