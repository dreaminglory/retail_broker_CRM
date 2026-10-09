import { getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { InquiryService } from "@/domain/inquiries/service";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { StageRepository } from "@/domain/stages/repository";
import { ContactService } from "@/domain/contacts/service";
import { MemberRepository } from "@/domain/members/repository";
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
  const [inquiries, leadSources, stages, contacts, brokers] = await Promise.all([
    new InquiryService(supabase).list(agencyId, {
      search: search || undefined,
      status: status === "all" ? undefined : status,
    }),
    new LeadSourceRepository(supabase).findActive(agencyId),
    new StageRepository(supabase).findActive(agencyId),
    new ContactService(supabase).list(agencyId, { status: "active", limit: 200 }),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <InquiriesPageClient
        inquiries={inquiries}
        leadSources={leadSources}
        stages={stages}
        contacts={contacts}
        brokers={brokers}
        initialSearch={search}
        initialStatus={status}
        initialId={id}
        userRole={membership?.role}
      />
    </div>
  );
}
