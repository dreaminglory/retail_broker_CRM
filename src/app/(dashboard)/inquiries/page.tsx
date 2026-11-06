import { getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InquiryService } from "@/domain/inquiries/service";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { StageRepository } from "@/domain/stages/repository";
import { MemberRepository } from "@/domain/members/repository";
import { ProfileRepository } from "@/domain/profiles/repository";
import { PAGE_SIZE, loadPage, pageInfo, parsePage } from "@/lib/pagination";
import { z } from "zod";
import { InquiriesPageClient } from "./inquiries-page-client";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";
import { getAgencySettings } from "@/domain/agencies/settings";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("inquiries") };
}


interface SearchParams {
  search?: string;
  status?: "new" | "contacted" | "converted" | "dismissed" | "all";
  page?: string;
  id?: string;
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "all";
  const id = params.id;
  const page = parsePage(params.page);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id, role")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyId = membership?.agency_id ?? "";

  if (!agencyId) {
    const tErrors = await getTranslations("errors");
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-muted-foreground">
          {tErrors("noMembership")}
        </p>
      </div>
    );
  }

  // Fetch all required data in parallel
  const [paged, leadSources, stages, brokers, settings] = await Promise.all([
    id ? loadInquiryById(supabase, agencyId, id) : loadPage(page, PAGE_SIZE, (offset, limit) =>
      new InquiryService(supabase).listPage(agencyId, {
        search: search || undefined,
        status: status === "all" ? undefined : status,
        limit,
        offset,
      })
    ),
    new LeadSourceRepository(supabase).findActive(agencyId),
    new StageRepository(supabase).findActive(agencyId),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
    getAgencySettings(agencyId),
  ]);

  // Assignees who were deactivated later aren't in the active list, but their inquiries still show them.
  const inquiries = paged.rows;
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

  // A fresh `now` per render: relative times match between the server and hydration.
  return (
    <FreshNowProvider now={new Date().toISOString()}>
      <div className="mx-auto max-w-4xl">
        <InquiriesPageClient
          inquiries={inquiries}
          pageInfo={paged.info}
          leadSources={leadSources}
          stages={stages}
          brokers={brokers}
          inactiveAssigneeNames={inactiveAssigneeNames}
          initialSearch={search}
          initialStatus={status}
          initialId={id}
          userRole={membership?.role}
          timeZone={settings.timezone}
          joinedDeals={joinedDeals}
        />
      </div>
    </FreshNowProvider>
  );
}

/** `?id=` deep link: the one inquiry, wherever it sits in the list; a bad or unknown id shows none. */
async function loadInquiryById(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  agencyId: string,
  id: string
) {
  const valid = z.string().uuid().safeParse(id).success;
  const inquiry = valid ? await new InquiryService(supabase).getById(id, agencyId) : null;
  const rows = inquiry ? [inquiry] : [];
  return { rows, total: rows.length, info: pageInfo(1, PAGE_SIZE, rows.length) };
}
