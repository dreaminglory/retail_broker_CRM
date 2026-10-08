import { createSupabaseServer } from "@/lib/supabase/server";
import { ContactService } from "@/domain/contacts/service";
import { ContactsPageClient } from "./contacts-page-client";

interface SearchParams {
  search?: string;
  status?: "active" | "archived" | "all";
  page?: string;
}

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "active";
  const page = Number(params.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

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
  const contacts = agencyId
    ? await service.list(agencyId, {
        search: search || undefined,
        status: status === "all" ? "all" : status === "archived" ? "archived" : "active",
        limit: PAGE_SIZE,
        offset,
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <ContactsPageClient
        contacts={contacts}
        initialSearch={search}
        initialStatus={status}
        agencyId={agencyId}
        userRole={membership?.role ?? "broker"}
      />
    </div>
  );
}
