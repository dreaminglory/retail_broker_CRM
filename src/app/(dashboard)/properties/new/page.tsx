import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { MemberRepository } from "@/domain/members/repository";
import { ContactService } from "@/domain/contacts/service";
import { OpportunityService } from "@/domain/opportunities/service";
import { NewPropertyClient, type SubjectOf } from "./new-property-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("newProperty") };
}

type Props = { searchParams: Promise<{ opportunity?: string }> };

export default async function NewPropertyPage({ searchParams }: Props) {
  const t = await getTranslations("PropertyForm");
  const membership = await getCurrentMembership();
  if (!membership) notFound();
  const supabase = await createSupabaseServer();
  const { opportunity: opportunityId } = await searchParams;

  const [brokers, subjectOf] = await Promise.all([
    new MemberRepository(supabase).getActiveBrokers(membership.agencyId),
    opportunityId && UUID.test(opportunityId) ? loadSubjectOf(opportunityId, membership.agencyId) : Promise.resolve(null),
  ]);
  // A deal link that doesn't resolve to the agency's seller or landlord deal is a 404, not a plain form.
  if (opportunityId && !subjectOf) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={subjectOf ? `/opportunities/${subjectOf.id}` : "/properties"}
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {subjectOf ? t("backToOpportunity") : t("backToList")}
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
      {subjectOf && (
        <p className="mb-6 rounded-lg border bg-muted/40 p-3 text-sm">
          {t("forOpportunity", { title: subjectOf.title })}
          {subjectOf.ownerName && <> {t("ownerFromOpportunity", { name: subjectOf.ownerName })}</>}
        </p>
      )}
      <NewPropertyClient brokers={brokers} currentUserId={membership.userId} subjectOf={subjectOf} />
    </div>
  );
}

/** The seller or landlord deal the new property will be the subject of, with its owner-to-be. */
async function loadSubjectOf(opportunityId: string, agencyId: string): Promise<SubjectOf | null> {
  const supabase = await createSupabaseServer();
  const opportunity = await new OpportunityService(supabase).getById(opportunityId, agencyId);
  if (!opportunity || (opportunity.type !== "seller" && opportunity.type !== "landlord")) return null;
  const [owner] = opportunity.primary_contact_id
    ? await new ContactService(supabase).getByIds([opportunity.primary_contact_id], agencyId)
    : [];
  return { id: opportunity.id, title: opportunity.title, ownerName: owner?.display_name ?? null };
}
