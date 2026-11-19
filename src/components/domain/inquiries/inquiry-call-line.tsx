"use client";

import { PhoneCall, PhoneForwarded, Timer } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useTaskOutcome } from "@/components/domain/tasks/task-outcome";
import { contactDelay } from "@/domain/inquiries/call-summary";
import type { Inquiry } from "@/domain/inquiries/types";
import { agencyDateKey } from "@/lib/time/agency-day";

type InquiryCallLineProps = {
  inquiry: Pick<Inquiry, "status" | "received_at" | "contacted_at" | "calls">;
  /** The agency's timezone: call times are agency time. */
  timeZone: string;
};

/**
 * "Contacted after 2 h 10 min", the last logged call and a pending retry on the inquiry card
 * (spec phone-loop rule 9).
 */
export function InquiryCallLine({ inquiry, timeZone }: InquiryCallLineProps) {
  const t = useTranslations("phoneLoop.card");
  const format = useFormatter();
  const outcomeText = useTaskOutcome();
  const now = useNow({ updateInterval: 60_000 });

  const delay = inquiry.contacted_at ? contactDelay(inquiry.received_at, inquiry.contacted_at) : null;
  const lastCall = inquiry.calls?.lastCall ?? null;
  const open = inquiry.status === "new" || inquiry.status === "contacted";
  const retryAt = open ? inquiry.calls?.nextRetryAt ?? null : null;
  if (!delay && !lastCall && !retryAt) return null;

  const today = agencyDateKey(timeZone, now);
  const when = (iso: string) => {
    const date = new Date(iso);
    return agencyDateKey(timeZone, date) === today
      ? format.dateTime(date, { hour: "2-digit", minute: "2-digit", timeZone })
      : format.dateTime(date, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone });
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-[11px] text-muted-foreground">
      {delay && (
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" aria-hidden />
          {t("contactedAfter", delay)}
        </span>
      )}
      {lastCall && (
        <span className="flex min-w-0 items-center gap-1">
          <PhoneCall className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">
            {t("lastCall", { outcome: lastCall.outcome ? outcomeText(lastCall.outcome) : "—", time: when(lastCall.at) })}
          </span>
        </span>
      )}
      {retryAt && (
        <span className="flex items-center gap-1 font-medium text-foreground">
          <PhoneForwarded className="h-3 w-3" aria-hidden />
          {t("retryAt", { time: when(retryAt) })}
        </span>
      )}
    </div>
  );
}
