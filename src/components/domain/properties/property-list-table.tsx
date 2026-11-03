"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { PropertyListRow } from "@/domain/properties/types";
import { propertyCode, propertyHeadline } from "./property-labels";

type PropertyListTableProps = {
  rows: PropertyListRow[];
  brokerNames: Map<string, string>;
  /** Whether filters are on, for the empty message. */
  filtered: boolean;
};

/** A table from md up, cards below (spec: mobile shows cards). */
export function PropertyListTable({ rows, brokerNames, filtered }: PropertyListTableProps) {
  const t = useTranslations("PropertiesPage");
  const enums = useTranslations("Enums");
  const format = useFormatter();

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
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
            <span className="font-medium tabular-nums">
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
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{t("columns.code")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("columns.property")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("columns.location")}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t("columns.size")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("columns.listings")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("columns.broker")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-accent/50">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{propertyCode(row)}</td>
                <td className="px-3 py-2">
                  <Link href={`/properties/${row.id}`} className="font-medium hover:underline">
                    {propertyHeadline(enums, row)}
                  </Link>
                  {row.status === "archived" && (
                    <Badge variant="outline" className="ml-2">{t("archived")}</Badge>
                  )}
                </td>
                <td className="px-3 py-2">{place(row)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{size(row)}</td>
                <td className="px-3 py-2">
                  {row.open_listings.length > 0 ? prices(row) : <span className="text-muted-foreground">{t("noListing")}</span>}
                </td>
                <td className="px-3 py-2">{broker(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/properties/${row.id}`} className="block space-y-1 rounded-lg border bg-card p-3 hover:bg-accent/50">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{propertyHeadline(enums, row)}</span>
                <span className="font-mono text-xs text-muted-foreground">{propertyCode(row)}</span>
              </span>
              <span className="block text-sm text-muted-foreground">
                {place(row)} · {size(row)}
              </span>
              <span className="block text-sm">
                {row.open_listings.length > 0 ? prices(row) : <span className="text-muted-foreground">{t("noListing")}</span>}
              </span>
              <span className="flex items-center justify-between text-xs text-muted-foreground">
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
