import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CONFIG_ROLES, hasRole } from "@/lib/roles";
import { getCurrentMembership } from "@/lib/membership";
import { AreaService } from "@/domain/areas/service";
import { SettlementService } from "@/domain/settlements/service";
import type { Locale } from "@/i18n/config";
import { AreasSettingsClient } from "./areas-settings-client";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("areas") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ settlement?: string }>;
}) {
  const t = await getTranslations("SettingsAreas");
  const membership = await getCurrentMembership();
  // Areas are configuration: owner/manager only (T6, AD-045).
  if (!membership || !hasRole(membership.role, CONFIG_ROLES)) redirect("/settings");

  const supabase = await createSupabaseServer();
  const locale = (await getLocale()) as Locale;
  const areaService = new AreaService(supabase);
  const settlementsWithAreas = await areaService.settlementsWithAreas(membership.agencyId, locale);

  // The settlement in the URL, else the first one that has areas.
  const { settlement: requested } = await searchParams;
  const settlementId =
    requested && UUID.test(requested) ? requested : settlementsWithAreas[0]?.settlement.id;
  const settlement = settlementId
    ? await new SettlementService(supabase).getById(settlementId, locale)
    : null;
  const areas = settlement ? await areaService.listForSettlement(membership.agencyId, settlement.id) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("settings")}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <AreasSettingsClient
        key={settlement?.id ?? "none"}
        settlement={settlement}
        settlementsWithAreas={settlementsWithAreas}
        areas={areas}
      />
    </div>
  );
}
