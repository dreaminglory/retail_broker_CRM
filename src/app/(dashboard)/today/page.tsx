import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/actions";
import { hasRole } from "@/lib/roles";
import { StageRepository } from "@/domain/stages/repository";
import { MemberRepository } from "@/domain/members/repository";
import { TodayPageClient } from "./today-page-client";
import { getTodayScreenData } from "./actions";
import { completeTaskAction } from "../opportunities/[id]/tasks/actions";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("today") };
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const result = await getTodayScreenData(scope);
  if (!result.success) redirect("/login");

  const { supabase, agencyId, role } = await getAuthContext();
  const [stages, brokers] = await Promise.all([
    new StageRepository(supabase).findAll(agencyId),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
  ]);

  return (
    <TodayPageClient
      {...result.data}
      canSwitchScope={hasRole(role, ["owner", "manager"])}
      stages={stages}
      brokers={brokers}
      completeAction={completeTaskAction}
    />
  );
}
