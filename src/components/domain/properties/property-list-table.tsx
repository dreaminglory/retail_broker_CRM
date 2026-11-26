"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Building2, Car, Home, LandPlot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PropertyType } from "@/domain/properties/types";
import type { PropertyListRow } from "@/domain/properties/types";
import { propertyCode, propertyHeadline } from "./property-labels";

type PropertyListTableProps = {
  rows: PropertyListRow[];
  brokerNames: Map<string, string>;
  /** Whether filters are on, for the empty message. */
  filtered: boolean;
};

/** The type icon in the first column (properties-list.png). */
const TYPE_ICON: Record<PropertyType, React.ComponentType<{ className?: string }>> = {
  apartment: Building2,
  studio: Building2,
  maisonette: Building2,
  house: Home,
  house_floor: Home,
  plot: LandPlot,
  garage: Car,
};

/** A table from md up, cards below (spec: mobile shows cards). */
export function PropertyListTable({ rows, brokerNames, filtered }: PropertyListTableProps) {
  const t = useTranslations("PropertiesPage");
  const enums = useTranslations("Enums");
  const format = useFormatter();

  if (rows.length === 0) {
    return (
      <p className="p-8 text-center text-body text-muted-foreground">
        {filtered ? t("noMatches") : t("empty")}
      </p>
    );
  }

  const place = (row: PropertyListRow) => [row.area_name, row.settlement_name].filter(Boolean).join(", ");
  const size = (row: PropertyListRow) => {
    const value = row.type === "plot" ? row.plot_m2 : row.area_m2;
    return value ? t("squareMeters", { value: format.number(Number(value), { maximumFractionDigits: 2 }) }) : "—";
  };
  const broker = (row: PropertyListRow) => (row.assigned_to ? brokerNames.get(row.assigned_to) ?? "—" : "—");
  const prices = (row: PropertyListRow) =>
    [...row.open_listings]
      .sort((a, b) => a.offer_type.localeCompare(b.offer_type))
      .map((listing) => {
        const price = format.number(Number(listing.price), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
        return (
          <span key={listing.id} className="block whitespace-nowrap">
            <span className="text-muted-foreground">{enums(`offerType.${listing.offer_type}`)}</span>{" "}
            <span className="font-semibold tabular-nums text-ink">
              {listing.offer_type === "rent" ? t("perMonth", { price }) : price}
            </span>
            {listing.status === "reserved" && (
              <Badge variant="secondary" className="ml-1">
                {enums("listingStatus.reserved")}
              </Badge>
            )}
          </span>
        );
      });

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-body">
          <thead className="border-b border-border text-left text-label uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">{t("columns.property")}</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">{t("columns.size")}</th>
              <th scope="col" className="px-3 py-3 font-semibold">{t("columns.listings")}</th>
              <th scope="col" className="px-5 py-3 font-semibold">{t("columns.broker")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const Icon = TYPE_ICON[row.type] ?? Building2;
              return (
                <tr key={row.id} className="hover:bg-muted">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-sea-light text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <Link href={`/properties/${row.id}`} className="text-body-strong text-ink hover:text-primary hover:underline">
                          {propertyHeadline(enums, row)}
                        </Link>
                        {row.status === "archived" && (
                          <Badge variant="outline" className="ml-2">{t("archived")}</Badge>
                        )}
                        <p className="truncate text-small text-muted-foreground">
                          <span className="tabular-nums">{propertyCode(row)}</span>
                          {place(row) && <> · {place(row)}</>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{size(row)}</td>
                  <td className="px-3 py-3">
                    {row.open_listings.length > 0 ? prices(row) : <span className="text-muted-foreground">{t("noListing")}</span>}
                  </td>
                  <td className="px-5 py-3">{broker(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/properties/${row.id}`} className="block space-y-1 p-4 hover:bg-muted">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-body-strong text-ink">{propertyHeadline(enums, row)}</span>
                <span className="text-small tabular-nums text-muted-foreground">{propertyCode(row)}</span>
              </span>
              <span className="block text-small text-muted-foreground">
                {place(row)} · <span className="tabular-nums">{size(row)}</span>
              </span>
              <span className="block text-body">
                {row.open_listings.length > 0 ? prices(row) : <span className="text-muted-foreground">{t("noListing")}</span>}
              </span>
              <span className="flex items-center justify-between text-small text-muted-foreground">
                {broker(row)}
                {row.status === "archived" && <Badge variant="outline">{t("archived")}</Badge>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
