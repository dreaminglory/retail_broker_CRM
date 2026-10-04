import { createSupabaseServer } from "@/lib/supabase/server";
import { OpportunityService } from "@/domain/opportunities/service";
import { StageRepository } from "@/domain/stages/repository";
import { LeadSourceRepository } from "@/domain/lead-sources/repository";
import { ContactService } from "@/domain/contacts/service";
import { MemberRepository } from "@/domain/members/repository";
import { OpportunitiesPageClient } from "./opportunities-page-client";
import type { OpportunityType } from "@/domain/opportunities/types";

interface SearchParams {
  search?: string;
  status?: "active" | "won" | "lost" | "nurture" | "archived" | "all";
  stage?: string;
  type?: OpportunityType | "all";
  page?: string;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "active";
  const stage = params.stage ?? "all";
  const type = params.type ?? "all";

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("agency_memberships")
    .select("agency_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single();

  const agencyId = membership?.agency_id ?? "";

  if (!agencyId) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-muted-foreground">
          No active agency membership found.
        </p>
      </div>
    );
  }

  // Fetch all required data in parallel
  const [opportunities, stages, leadSources, contacts, brokers] = await Promise.all([
    new OpportunityService(supabase).list(agencyId, {
      search: search || undefined,
      status: status === "all" ? "all" : status,
      stageId: stage === "all" ? undefined : stage,
      type: type === "all" ? "all" : type,
      limit: 200,
    }),
    new StageRepository(supabase).findActive(agencyId),
    new LeadSourceRepository(supabase).findActive(agencyId),
    new ContactService(supabase).list(agencyId, { status: "active", limit: 200 }),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <OpportunitiesPageClient
        opportunities={opportunities}
        stages={stages}
        leadSources={leadSources}
        contacts={contacts}
        brokers={brokers}
        initialSearch={search}
        initialStatus={status}
        initialStage={stage}
        initialType={type}
      />
    </div>
  );
}
