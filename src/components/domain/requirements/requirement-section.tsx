"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OpportunityType } from "@/domain/opportunities/types";
import type { MustCriterion, Requirement } from "@/domain/requirements/types";
import {
  formatArea,
  formatBudget,
  formatFloor,
  formatRooms,
  formatTypes,
  summarizeRequirement,
  type SummaryTools,
} from "@/domain/requirements/summary";

type RequirementSectionProps = {
  requirement: Requirement | null;
  opportunityType: OpportunityType;
  /** The add, edit and remove controls, when the deal is editable. */
  actions?: ReactNode;
};

/** The client's search on a buyer or tenant deal (spec: requirements, Screens). */
export function RequirementSection({ requirement, opportunityType, actions }: RequirementSectionProps) {
  const t = useTranslations("RequirementSection");

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="opportunity-requirement">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h3 id="opportunity-requirement" className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </h3>
        {actions}
      </div>

      {requirement ? (
        <RequirementDetails requirement={requirement} opportunityType={opportunityType} />
      ) : (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}
    </section>
  );
}

function RequirementDetails({ requirement, opportunityType }: { requirement: Requirement; opportunityType: OpportunityType }) {
  const t = useTranslations("RequirementSection");
  const tools: SummaryTools = {
    t: useTranslations("requirements"),
    enums: useTranslations("Enums"),
    format: useFormatter(),
  };
  const { enums, format } = tools;
  const parts = summarizeRequirement(requirement, opportunityType, tools);

  const rows: { label: string; value: ReactNode; must?: boolean }[] = [];
  const add = (label: string, value: ReactNode | null, criterion?: MustCriterion) => {
    if (value === null) return;
    rows.push({ label, value, must: criterion ? requirement[`${criterion}_must`] : false });
  };

  add(t(opportunityType === "tenant" ? "budgetRent" : "budgetPrice"), formatBudget(requirement, opportunityType, tools), "budget");
  add(
    t("locations"),
    requirement.locations.length === 0 ? null : (
      <ul className="flex flex-wrap gap-1.5">
        {requirement.locations.map((location) => (
          <li key={`${location.settlement_id}:${location.area_id ?? ""}`}>
            <Badge variant="secondary" className="gap-1 font-normal">
              {location.area_name
                ? tools.t("areaInSettlement", { area: location.area_name, settlement: location.settlement_name })
                : location.settlement_name}
              {location.area_active === false && <span className="text-muted-foreground">· {t("inactiveArea")}</span>}
            </Badge>
          </li>
        ))}
      </ul>
    ),
    "location",
  );
  add(t("types"), formatTypes(requirement, tools), "type");
  add(t("rooms"), formatRooms(requirement, tools), "rooms");
  add(t("areaM2"), formatArea(requirement, tools), "area_m2");
  add(t("floor"), formatFloor(requirement, tools), "floor");
  add(
    t("construction"),
    requirement.construction.length === 0
      ? null
      : format.list(requirement.construction.map((value) => enums(`construction.${value}`)), { type: "disjunction" }),
    "construction",
  );
  add(t("financing"), requirement.financing === "unknown" ? null : enums(`financing.${requirement.financing}`));
  add(t("wishes"), requirement.wishes ? <span className="whitespace-pre-wrap">{requirement.wishes}</span> : null);

  return (
    <div className="space-y-4 px-5 py-4">
      <p className="text-sm" data-testid="requirement-summary">
        {parts.map((part, index) => (
          <span key={part.criterion}>
            {index > 0 && ", "}
            <span className={part.must ? "font-semibold" : undefined}>{part.text}</span>
            {part.must && <span className="sr-only"> ({t("mustHave")})</span>}
          </span>
        ))}
      </p>

      <dl className="space-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {row.value}
              {row.must && <Badge variant="outline">{t("mustHave")}</Badge>}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted-foreground">
        {t("updatedOn", { date: format.dateTime(new Date(requirement.updated_at), { day: "numeric", month: "short", year: "numeric" }) })}
      </p>
    </div>
  );
}
