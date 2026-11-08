import { getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InquiryService } from "@/domain/inquiries/service";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { StageRepository } from "@/domain/stages/repository";
import { MemberRepository } from "@/domain/members/repository";
import { loadInquiryRowContext } from "./inquiry-row-context";
import { PAGE_SIZE, loadPage, pageInfo, parsePage } from "@/lib/pagination";
import { z } from "zod";
import { InquiriesPageClient } from "./inquiries-page-client";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";
import { getAgencySettings } from "@/domain/agencies/settings";
import { SmartListService, canEditList, type Viewer } from "@/domain/smart-lists/service";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("inquiries") };
}


interface SearchParams {
  search?: string;
  status?: "new" | "contacted" | "converted" | "dismissed" | "all";
  page?: string;
  id?: string;
  /** A saved inquiry list being edited ("Edit filters"): the page shows "Update list". */
  list?: string;
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
  const viewer: Viewer = { userId: user!.id, agencyId, role: membership?.role ?? "" };
  const [paged, leadSources, stages, brokers, settings, editingList] = await Promise.all([
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
    params.list ? loadEditingList(new SmartListService(supabase), viewer, params.list) : null,
  ]);

  const inquiries = paged.rows;
  const { inactiveAssigneeNames, joinedDeals } = await loadInquiryRowContext(supabase, agencyId, inquiries, brokers);

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
          editingList={editingList}
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

/** The saved inquiry list opened from "Edit filters", if the viewer may change it; else none. */
async function loadEditingList(service: SmartListService, viewer: Viewer, listId: string) {
  const list = await service.resolve(viewer, listId, "mine");
  if (list?.kind !== "saved" || list.entity !== "inquiry" || !canEditList(viewer, list.list)) return null;
  return { id: list.id, name: list.list.name };
}
