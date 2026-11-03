import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { MemberRepository } from "@/domain/members/repository";
import { NewPropertyClient } from "./new-property-client";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("newProperty") };
}

export default async function NewPropertyPage() {
  const t = await getTranslations("PropertyForm");
  const membership = await getCurrentMembership();
  if (!membership) notFound();
  const supabase = await createSupabaseServer();
  const brokers = await new MemberRepository(supabase).getActiveBrokers(membership.agencyId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/properties"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t("newTitle")}</h1>
      <NewPropertyClient brokers={brokers} currentUserId={membership.userId} />
    </div>
  );
}
