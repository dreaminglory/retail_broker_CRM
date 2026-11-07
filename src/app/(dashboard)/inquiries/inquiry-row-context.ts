import type { SupabaseClient } from "@supabase/supabase-js";
import { ProfileRepository } from "@/domain/profiles/repository";
import type { ActiveBroker } from "@/domain/members/types";
import type { Inquiry } from "@/domain/inquiries/types";

export type InquiryRowContext = {
  /** Assignees deactivated since, who still show on their inquiries. */
  inactiveAssigneeNames: Record<string, string>;
  /** Converted inquiries that joined a deal other than the one they started, by inquiry id. */
  joinedDeals: Record<string, { id: string; title: string }>;
};

/** What the inquiry rows show beyond the inquiry itself, for the inquiry list and smart lists. */
export async function loadInquiryRowContext(
  supabase: SupabaseClient,
  agencyId: string,
  inquiries: Inquiry[],
  brokers: ActiveBroker[]
): Promise<InquiryRowContext> {
  // Assignees who were deactivated later aren't in the active list, but their inquiries still show them.
  const activeIds = new Set(brokers.map((b) => b.id));
  const inactiveIds = inquiries.flatMap((i) =>
    i.assigned_to && !activeIds.has(i.assigned_to) ? [i.assigned_to] : []
  );
  const inactiveProfiles = await new ProfileRepository(supabase).getProfilesByIds(inactiveIds);
  const inactiveAssigneeNames = Object.fromEntries(
    [...inactiveProfiles].flatMap(([id, profile]) =>
      profile.display_name ? [[id, profile.display_name]] : []
    )
  );

  // A converted inquiry "joined" a deal when that deal started from another inquiry (AD-061).
  const convertedIds = [...new Set(inquiries.flatMap((i) => (i.status === "converted" && i.opportunity_id ? [i.opportunity_id] : [])))];
  const { data: deals } = convertedIds.length
    ? await supabase.from("opportunities").select("id, title, inquiry_id").eq("agency_id", agencyId).in("id", convertedIds)
    : { data: [] };
  const dealById = new Map((deals ?? []).map((d) => [d.id as string, d]));
  const joinedDeals = Object.fromEntries(
    inquiries.flatMap((i) => {
      const deal = i.opportunity_id ? dealById.get(i.opportunity_id) : undefined;
      return i.status === "converted" && deal && deal.inquiry_id !== i.id
        ? [[i.id, { id: deal.id as string, title: deal.title as string }]]
        : [];
    })
  );

  return { inactiveAssigneeNames, joinedDeals };
}
