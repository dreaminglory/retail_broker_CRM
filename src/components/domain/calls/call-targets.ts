/**
 * What a call from the opportunity or the contact page logs against (spec phone-loop rule 2).
 * Pure, so the "one active deal → automatic, several → picker" rule is unit-tested.
 */

import type { CallDeal, PostCallTarget } from "./post-call-sheet";

type DealRow = { id: string; title: string; stage_id: string; status: string };
type ContactRow = { id: string; display_name: string };
type StageOption = { id: string; name: string };

export type CallTargetBase = Omit<PostCallTarget, "channel">;

function toCallDeal(deal: DealRow, pendingTaskCount: number): CallDeal {
  return { id: deal.id, title: deal.title, stageId: deal.stage_id, active: deal.status === "active", pendingTaskCount };
}

/** Opportunity page: the deal and the tapped contact (the primary contact for "Log call"). */
export function opportunityCallTarget(
  deal: DealRow,
  contact: ContactRow | null,
  pendingTaskCount: number,
  stages: StageOption[]
): CallTargetBase {
  return {
    context: { opportunity_id: deal.id, contact_id: contact?.id ?? null },
    name: contact?.display_name ?? deal.title,
    deal: toCallDeal(deal, pendingTaskCount),
    stages,
  };
}

/** Contact page: the contact, plus its one active deal; several active deals → a picker. */
export function contactCallTarget(
  contact: ContactRow,
  deals: DealRow[],
  pendingCounts: Record<string, number>,
  stages: StageOption[]
): CallTargetBase {
  const active = deals.filter((d) => d.status === "active").map((d) => toCallDeal(d, pendingCounts[d.id] ?? 0));
  const base = { context: { contact_id: contact.id }, name: contact.display_name, stages };
  if (active.length === 1) return { ...base, context: { ...base.context, opportunity_id: active[0].id }, deal: active[0] };
  if (active.length > 1) return { ...base, dealChoices: active };
  return base;
}
