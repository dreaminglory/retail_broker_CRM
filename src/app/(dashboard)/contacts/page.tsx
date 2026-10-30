import { getTranslations } from "next-intl/server";
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
  const paged = agencyId
    ? await loadPage(page, PAGE_SIZE, (offset, limit) =>
        service.listPage(agencyId, {
          search: search || undefined,
          status: status === "all" ? "all" : status === "archived" ? "archived" : "active",
          limit,
          offset,
        })
      )
    : { rows: [], total: 0, info: pageInfo(1, PAGE_SIZE, 0) };

  return (
    <div className="mx-auto max-w-5xl">
      <ContactsPageClient
        contacts={paged.rows}
        pageInfo={paged.info}
        initialSearch={search}
        initialStatus={status}
        agencyId={agencyId}
        userRole={membership?.role ?? "broker"}
      />
    </div>
  );
}
