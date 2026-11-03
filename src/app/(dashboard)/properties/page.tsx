import { getLocale, getTranslations } from "next-intl/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/membership";
import { PAGE_SIZE, loadPage, parsePage } from "@/lib/pagination";
import { AreaService } from "@/domain/areas/service";
import { MemberRepository } from "@/domain/members/repository";
import { parsePropertyListFilters } from "@/domain/properties/list-filters";
import { PropertyService } from "@/domain/properties/service";
import { SettlementService } from "@/domain/settlements/service";
import type { Locale } from "@/i18n/config";
import { PropertiesPageClient } from "./properties-page-client";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("properties") };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const membership = await getCurrentMembership();
  if (!membership) {
    const tErrors = await getTranslations("errors");
    return <p className="text-sm text-muted-foreground">{tErrors("noMembership")}</p>;
  }
  const params = await searchParams;
  const filters = parsePropertyListFilters(params);
  const page = parsePage(params.page);
  const supabase = await createSupabaseServer();
  const locale = (await getLocale()) as Locale;
  const { agencyId } = membership;

  const [paged, brokers, settlement, areas] = await Promise.all([
    loadPage(page, PAGE_SIZE, (offset, limit) =>
      new PropertyService(supabase).listPage(agencyId, filters, locale, { offset, limit })
    ),
    new MemberRepository(supabase).getActiveBrokers(agencyId),
    filters.settlementId ? new SettlementService(supabase).getById(filters.settlementId, locale) : null,
    filters.settlementId ? new AreaService(supabase).listForSettlement(agencyId, filters.settlementId) : [],
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PropertiesPageClient
        rows={paged.rows}
        pageInfo={paged.info}
        filters={filters}
        brokers={brokers}
        settlement={settlement}
        areas={areas.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
