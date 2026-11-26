import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";
import { hrefWithParam } from "@/lib/url-state";
import { ContactPanel } from "@/components/domain/contacts/contact-panel";
import { loadContactDetail } from "./contact-data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ContactService } from "@/domain/contacts/service";
import { PAGE_SIZE, loadPage, pageInfo, parsePage } from "@/lib/pagination";
import { ContactsPageClient } from "./contacts-page-client";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("contacts") };
}


interface SearchParams {
  search?: string;
  status?: "active" | "archived" | "all";
  page?: string;
  /** The contact shown in the panel (spec ui-bright, master-detail). */
  id?: string;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "active";
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

  const service = new ContactService(supabase);
  const locale = (await getLocale()) as Locale;
  // The panel loads through the contact page's own loader (agency-scoped): no new query, and an
  // unknown or other agency's id gives no panel.
  const validId = !!params.id && z.string().uuid().safeParse(params.id).success;
  const [paged, detail] = await Promise.all([
    agencyId
      ? loadPage(page, PAGE_SIZE, (offset, limit) =>
          service.listPage(agencyId, {
            search: search || undefined,
            status: status === "all" ? "all" : status === "archived" ? "archived" : "active",
            limit,
            offset,
          })
        )
      : { rows: [], total: 0, info: pageInfo(1, PAGE_SIZE, 0) },
    agencyId && validId ? loadContactDetail(supabase, agencyId, params.id!, locale) : null,
  ]);

  const query = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  ).toString();

  return (
    <FreshNowProvider now={new Date().toISOString()}>
      <div className="mx-auto max-w-6xl">
        <ContactsPageClient
          contacts={paged.rows}
          pageInfo={paged.info}
          initialSearch={search}
          initialStatus={status}
          agencyId={agencyId}
          userRole={membership?.role ?? "broker"}
          selectedId={detail?.contact.id ?? null}
          panel={
            detail ? (
              <ContactPanel detail={detail} backHref={hrefWithParam("/contacts", query, "id", null)} currentUserId={user?.id} />
            ) : null
          }
        />
      </div>
    </FreshNowProvider>
  );
}
