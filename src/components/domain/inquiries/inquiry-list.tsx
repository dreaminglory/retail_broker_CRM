"use client";

import type { ReactNode } from "react";
import { ListPager } from "@/components/ui/list-pager";
import { InquiryCard } from "@/components/domain/inquiries/inquiry-card";
import { useInquiryActions } from "@/components/domain/inquiries/inquiry-actions";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Stage } from "@/domain/stages/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { PageInfo } from "@/lib/pagination";

type InquiryListProps = {
  inquiries: Inquiry[];
  /** Null hides the pager (the `?id=` deep link shows one inquiry). */
  pageInfo: PageInfo | null;
  leadSources: LeadSource[];
  stages: Stage[];
  brokers: ActiveBroker[];
  inactiveAssigneeNames: Record<string, string>;
  timeZone: string;
  /** Converted inquiries that joined a deal other than the one they started, by inquiry id. */
  joinedDeals: Record<string, { id: string; title: string }>;
  /** Shown instead of the rows when there are none. */
  empty?: ReactNode;
  /** Dims the rows while the page navigates to new filters. */
  pending?: boolean;
};

/**
 * Inquiry cards with their actions (edit and reassign, mark contacted, dismiss, convert or join)
 * and the pager; on the inquiries page and on an inquiry smart list. Each action refreshes the
 * page, so the rows and any count around them follow (smart-lists rule 8).
 */
export function InquiryList({
  inquiries,
  pageInfo,
  leadSources,
  stages,
  brokers,
  inactiveAssigneeNames,
  timeZone,
  joinedDeals,
  empty,
  pending = false,
}: InquiryListProps) {
  const { handlers, dialogs } = useInquiryActions({ leadSources, stages, brokers, inactiveAssigneeNames, timeZone });

  return (
    <>
      <div className={`space-y-2 ${pending ? "opacity-60 pointer-events-none" : ""}`}>
        {inquiries.length === 0
          ? empty
          : inquiries.map((inquiry) => (
              <InquiryCard
                key={inquiry.id}
                inquiry={inquiry}
                leadSources={leadSources}
                brokers={brokers}
                inactiveAssigneeNames={inactiveAssigneeNames}
                joinedDeal={joinedDeals[inquiry.id]}
                timeZone={timeZone}
                {...handlers}
              />
            ))}
      </div>
      {pageInfo && <ListPager page={pageInfo.page} pageSize={pageInfo.pageSize} total={pageInfo.total} />}
      {dialogs}
    </>
  );
}
