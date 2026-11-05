"use client";

import { ArrowRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type {
  AuditEvent,
  RequirementAuditLocation,
  RequirementChange,
  RequirementChangeValue,
  RequirementField,
} from "@/domain/timeline/audit-event";

type RequirementEvent = Extract<AuditEvent, { kind: "requirement" }>;

const MUST_FIELDS: Partial<Record<RequirementField, string>> = {
  budget_must: "budget",
  location_must: "location",
  type_must: "type",
  rooms_must: "rooms",
  area_m2_must: "area_m2",
  floor_must: "floor",
  construction_must: "construction",
};

/**
 * One requirement save on a timeline (AD-059): each changed criterion as old → new. A created
 * entry shows what was set and a removed one what it had, with the must-haves on one line.
 * Locations show the names they had when saved, in the user's language.
 */
export function RequirementChanges({ event }: { event: RequirementEvent }) {
  const t = useTranslations("Timeline.requirement");
  const tRequirements = useTranslations("requirements");
  const enums = useTranslations("Enums");
  const format = useFormatter();
  const locale = useLocale();

  const empty = (value: RequirementChangeValue) =>
    value === null || value === "" || (Array.isArray(value) && value.length === 0);

  function show(field: RequirementField, value: RequirementChangeValue): string {
    if (typeof value === "boolean") return t(value ? "yes" : "no");
    if (empty(value)) return t("none");
    if (field === "locations" && Array.isArray(value)) {
      return (value as RequirementAuditLocation[])
        .map((location) => {
          const settlement = locale === "bg" ? location.settlementBg : location.settlementEn;
          return location.area ? tRequirements("areaInSettlement", { area: location.area, settlement }) : settlement;
        })
        .join(", ");
    }
    if (Array.isArray(value)) {
      // As in the summary line: "Апартамент или мезонет"; construction names keep their case (ЕПК).
      const names =
        field === "property_types"
          ? (value as string[]).map((item, index) => {
              const name = enums(`propertyType.${item}`);
              return index === 0 ? name : name.toLocaleLowerCase();
            })
          : (value as string[]).map((item) => enums(`construction.${item}`));
      return format.list(names, { type: "disjunction" });
    }
    if (typeof value === "number") {
      if (field.startsWith("budget_")) return format.number(value, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
      if (field.startsWith("area_m2_")) return tRequirements("m2", { value: format.number(value) });
      return format.number(value);
    }
    if (field === "financing") return enums(`financing.${value}`);
    return String(value);
  }

  const isMust = (change: RequirementChange) => change.field in MUST_FIELDS;

  if (event.event === "changed") {
    return (
      <dl className="space-y-1">
        {event.changes.map((change) => (
          <div key={change.field} className="flex flex-wrap items-baseline gap-x-2">
            <dt>{t(`fields.${change.field}`)}:</dt>
            <dd className="flex flex-wrap items-baseline gap-x-1.5 text-foreground">
              <span className="text-muted-foreground line-through decoration-muted-foreground/50">{show(change.field, change.from)}</span>
              <ArrowRight className="h-3 w-3 self-center" aria-hidden />
              <span>{show(change.field, change.to)}</span>
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  // Created: the values set. Removed: the values it had.
  const side = (change: RequirementChange) => (event.event === "created" ? change.to : change.from);
  const musts = event.changes.filter((change) => isMust(change) && side(change) === true);

  return (
    <dl className="space-y-1">
      {event.changes
        .filter((change) => !isMust(change))
        .map((change) => (
          <div key={change.field} className="flex flex-wrap items-baseline gap-x-2">
            <dt>{t(`fields.${change.field}`)}:</dt>
            <dd className="text-foreground">{show(change.field, side(change))}</dd>
          </div>
        ))}
      {musts.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt>{t("mustList")}:</dt>
          <dd className="text-foreground">{musts.map((change) => t(`criteria.${MUST_FIELDS[change.field]}`)).join(", ")}</dd>
        </div>
      )}
    </dl>
  );
}
