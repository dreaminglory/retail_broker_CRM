"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettlementCombobox } from "@/components/domain/settlements/settlement-combobox";
import type { Area } from "@/domain/areas/types";
import { LISTING_STATUSES, OFFER_TYPES } from "@/domain/listings/validation";
import type { ActiveBroker } from "@/domain/members/types";
import type { PropertyListFilters } from "@/domain/properties/list-filters";
import { PROPERTY_TYPES } from "@/domain/properties/validation";
import type { Settlement } from "@/domain/settlements/types";

const ALL = "all";
const ROOMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type PropertyFiltersProps = {
  filters: PropertyListFilters;
  brokers: ActiveBroker[];
  settlement: Settlement | null;
  areas: Pick<Area, "id" | "name">[];
  /** URL parameter changes; null clears one. */
  onChange: (changes: Record<string, string | null>) => void;
};

export function PropertyFilters({ filters, brokers, settlement, areas, onChange }: PropertyFiltersProps) {
  const t = useTranslations("PropertyFilters");
  const enums = useTranslations("Enums");

  function select(
    id: string,
    label: string,
    param: string,
    value: string | number | undefined,
    options: { value: string; label: string }[],
    allLabel: string,
    disabled = false,
  ) {
    const current = value === undefined ? ALL : String(value);
    return (
      <div className="space-y-1">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Select
          value={current}
          onValueChange={(next) => onChange({ [param]: next === ALL ? null : (next as string) })}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue>
              {(selected: string) => options.find((option) => option.value === selected)?.label ?? allLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{allLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  function applyPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const clean = (name: string) => String(data.get(name) ?? "").replace(/[\s ]/g, "") || null;
    onChange({ min: clean("min"), max: clean("max") });
  }

  const hasFilters =
    Object.keys(filters).some((key) => key !== "status") || filters.status !== "active";

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {select(
          "filter-type",
          t("type"),
          "type",
          filters.type,
          PROPERTY_TYPES.map((value) => ({ value, label: enums(`propertyType.${value}`) })),
          t("allTypes"),
        )}
        <div className="col-span-2 space-y-1 md:col-span-1">
          <Label htmlFor="filter-settlement" className="text-xs text-muted-foreground">
            {t("settlement")}
          </Label>
          <SettlementCombobox
            key={settlement?.id ?? "none"}
            id="filter-settlement"
            defaultValue={settlement}
            onChange={(next) => {
              if ((next?.id ?? null) !== (settlement?.id ?? null)) onChange({ settlement: next?.id ?? null, area: null });
            }}
          />
        </div>
        {select(
          "filter-area",
          t("area"),
          "area",
          filters.areaId,
          areas.map((area) => ({ value: area.id, label: area.name })),
          settlement ? t("allAreas") : t("pickSettlementFirst"),
          !settlement,
        )}
        {select(
          "filter-rooms",
          t("rooms"),
          "rooms",
          filters.rooms,
          ROOMS.map((value) => ({ value, label: value })),
          t("anyRooms"),
        )}
        {select(
          "filter-offer",
          t("offerType"),
          "offer",
          filters.offerType,
          OFFER_TYPES.map((value) => ({ value, label: enums(`offerType.${value}`) })),
          t("anyOffer"),
        )}
        {select(
          "filter-listing",
          t("listingStatus"),
          "listing",
          filters.listingStatus,
          LISTING_STATUSES.map((value) => ({ value, label: enums(`listingStatus.${value}`) })),
          t("anyListingStatus"),
        )}
        {select(
          "filter-broker",
          t("broker"),
          "broker",
          filters.assignedTo,
          brokers.map((broker) => ({ value: broker.id, label: broker.display_name })),
          t("allBrokers"),
        )}
        <div className="space-y-1">
          <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
            {t("status")}
          </Label>
          <Select value={filters.status} onValueChange={(next) => onChange({ status: next === "active" ? null : (next as string) })}>
            <SelectTrigger id="filter-status" className="w-full">
              <SelectValue>{(value: string) => t(`statuses.${value}` as never)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(["active", "archived", "all"] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`statuses.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          key={`${filters.priceMin ?? ""}-${filters.priceMax ?? ""}`}
          onSubmit={applyPrice}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="space-y-1">
            <Label htmlFor="filter-min" className="text-xs text-muted-foreground">
              {t("priceFrom")}
            </Label>
            <Input id="filter-min" name="min" inputMode="numeric" className="w-32" defaultValue={filters.priceMin ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-max" className="text-xs text-muted-foreground">
              {t("priceTo")}
            </Label>
            <Input id="filter-max" name="max" inputMode="numeric" className="w-32" defaultValue={filters.priceMax ?? ""} />
          </div>
          <Button type="submit" variant="secondary">
            {t("applyPrice")}
          </Button>
        </form>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                type: null, settlement: null, area: null, rooms: null, offer: null,
                listing: null, broker: null, status: null, min: null, max: null,
              })
            }
          >
            <X className="mr-1 h-4 w-4" />
            {t("clear")}
          </Button>
        )}
      </div>
      {(filters.offerType || filters.listingStatus || filters.priceMin !== undefined || filters.priceMax !== undefined) && (
        <p className="text-xs text-muted-foreground">{t("listingFilterNote")}</p>
      )}
    </div>
  );
}
