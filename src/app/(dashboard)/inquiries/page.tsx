import { getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InquiryService } from "@/domain/inquiries/service";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { StageRepository } from "@/domain/stages/repository";
import { MemberRepository } from "@/domain/members/repository";
import { ProfileRepository } from "@/domain/profiles/repository";
import { PAGE_SIZE, loadPage, parsePage } from "@/lib/pagination";
import { InquiriesPageClient } from "./inquiries-page-client";

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
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-muted-foreground">
          No active agency membership found.
        </p>
      </div>
    );
  }

  // Fetch all required data in parallel
  const [paged, leadSources, stages, brokers] = await Promise.all([
    loadPage(page, PAGE_SIZE, (offset, limit) =>
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

  return (
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
      />
    </div>
  );
}
