import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/i18n/config";
import { ContactService } from "@/domain/contacts/service";
import { TimelineService } from "@/domain/timeline/service";
import { OpportunityService } from "@/domain/opportunities/service";
import { RequirementService } from "@/domain/requirements/service";
import { StageRepository } from "@/domain/stages/repository";
import { PropertyPartyService } from "@/domain/property-parties/service";
import { TaskService } from "@/domain/tasks/service";
import { contactCallTarget } from "@/components/domain/calls/call-targets";

/**
 * Everything the contact page shows about one contact, scoped to the agency. The contacts list's
 * panel (spec ui-bright, master-detail) loads through this too, so it never runs a query the
 * contact page doesn't. Null when the contact isn't in this agency.
 */
export async function loadContactDetail(supabase: SupabaseClient, agencyId: string, id: string, locale: Locale) {
  const contact = await new ContactService(supabase).getById(id, agencyId);
  if (!contact) return null;

  const opportunitiesPromise = new OpportunityService(supabase).getByContactId(id, agencyId);
  // The linked deals' summary lines (FR-REQ-05) load as soon as the deals are in.
  const [timeline, opportunities, requirementSummaries, stages, propertyParties, pendingCounts] = await Promise.all([
    new TimelineService(supabase).getContactTimeline(id, agencyId),
    opportunitiesPromise,
    opportunitiesPromise.then((opportunities) => new RequirementService(supabase).getSummaries(opportunities, agencyId, locale)),
    new StageRepository(supabase).findActive(agencyId),
    new PropertyPartyService(supabase).listForContact(id, agencyId, locale),
    // Pending tasks per active deal, for the post-call "no next action" warning (spec phone-loop rule 7).
    opportunitiesPromise.then((opportunities) =>
      new TaskService(supabase).pendingCounts(agencyId, opportunities.filter((o) => o.status === "active").map((o) => o.id))
    ),
  ]);

  // A call from this contact: the contact, plus its one active deal or a picker (spec phone-loop rule 2).
  const callTarget = contactCallTarget(
    contact,
    opportunities,
    pendingCounts,
    stages.map((s) => ({ id: s.id, name: s.name }))
  );

  return { contact, timeline, opportunities, requirementSummaries, stages, propertyParties, callTarget };
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof loadContactDetail>>>;
