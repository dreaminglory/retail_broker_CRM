"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListPager } from "@/components/ui/list-pager";
import { PropertyFilters } from "@/components/domain/properties/property-filters";
import { PropertyListTable } from "@/components/domain/properties/property-list-table";
import type { Area } from "@/domain/areas/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { PropertyListFilters } from "@/domain/properties/list-filters";
import type { PropertyListRow } from "@/domain/properties/types";
import type { Settlement } from "@/domain/settlements/types";
import type { PageInfo } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PropertiesPageClientProps = {
  rows: PropertyListRow[];
  pageInfo: PageInfo;
  filters: PropertyListFilters;
  brokers: ActiveBroker[];
  settlement: Settlement | null;
  areas: Pick<Area, "id" | "name">[];
};

export function PropertiesPageClient({ rows, pageInfo, filters, brokers, settlement, areas }: PropertiesPageClientProps) {
  const t = useTranslations("PropertiesPage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  /** Sets or clears URL filters and goes back to page 1. */
  function updateParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  const brokerNames = new Map(brokers.map((broker) => [broker.id, broker.display_name]));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">{t("title")}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t("count", { count: pageInfo.total })}</p>
        </div>
        {/* The view's one main action (properties-list.png). */}
        <Button emphasis="action" nativeButton={false} render={<Link href="/properties/new" />}>
          <Plus className="size-4" aria-hidden />
          {t("newProperty")}
        </Button>
      </div>

      {/* One card: filters on top, the table, the pager in its footer. */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <PropertyFilters
          filters={filters}
          brokers={brokers}
          settlement={settlement}
          areas={areas}
          onChange={updateParams}
        />
        <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
          <PropertyListTable rows={rows} brokerNames={brokerNames} filtered={Object.keys(filters).length > 1 || filters.status !== "active"} />
        </div>
        <div className="border-t border-border px-4 sm:px-5">
          <ListPager page={pageInfo.page} pageSize={pageInfo.pageSize} total={pageInfo.total} />
        </div>
      </div>
    </>
  );
}
