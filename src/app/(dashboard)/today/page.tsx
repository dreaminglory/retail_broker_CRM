import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/actions";
import { StageRepository } from "@/domain/stages/repository";
import { MemberRepository } from "@/domain/members/repository";
import { FreshNowProvider } from "@/lib/i18n/fresh-now-provider";
import { TodayPageClient } from "./today-page-client";
import { canSwitchTodayScope, loadTodayScreenData } from "./today-data";
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

  // Only a missing session or membership means "sign in"; any other failure
  // reaches the error boundary.
  let ctx: AuthContext;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/login");
  }

  const { supabase, agencyId, role } = ctx;
  const [data, stages, brokers] = await Promise.all([
    loadTodayScreenData(ctx, scope),
    new StageRepository(supabase).findAll(agencyId),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
  ]);

  // A fresh `now` per render, so relative times ("overdue · 2 hours ago")
  // don't start from the first page load after a soft navigation.
  return (
    <FreshNowProvider now={new Date().toISOString()}>
      <TodayPageClient
        {...data}
        canSwitchScope={canSwitchTodayScope(role)}
        stages={stages}
        brokers={brokers}
        completeAction={completeTaskAction}
      />
    </FreshNowProvider>
  );
}
