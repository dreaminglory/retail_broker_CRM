"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removeRequirementAction } from "@/app/(dashboard)/opportunities/[id]/requirement/actions";
import { RequirementFormSheet } from "./requirement-form";
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
  opportunityId: string;
  requirement: Requirement | null;
  opportunityType: OpportunityType;
  /** False on a won, lost or archived deal: no add, edit or remove (rule 7). */
  editable: boolean;
};

/** The client's search on a buyer or tenant deal (spec: requirements, Screens). */
export function RequirementSection({ opportunityId, requirement, opportunityType, editable }: RequirementSectionProps) {
  const t = useTranslations("RequirementSection");
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, startRemoving] = useTransition();

  function remove() {
    startRemoving(async () => {
      const result = await removeRequirementAction(opportunityId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setConfirmingRemove(false);
      toast.success(t("removed"));
    });
  }

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="opportunity-requirement">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h3 id="opportunity-requirement" className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </h3>
        {editable && (
          <div className="flex items-center gap-1">
            {requirement && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(true)} disabled={removing}>
                <Trash2 className="mr-1 h-4 w-4" />
                {t("remove")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={removing}>
              {requirement ? <Pencil className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
              {t(requirement ? "edit" : "add")}
            </Button>
          </div>
        )}
      </div>

      {requirement ? (
        <RequirementDetails requirement={requirement} opportunityType={opportunityType} />
      ) : (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}

      {!editable && <p className="border-t px-5 py-3 text-xs text-muted-foreground">{t("readOnly")}</p>}

      {editable && (
        <RequirementFormSheet
          open={editing}
          onOpenChange={setEditing}
          opportunityId={opportunityId}
          opportunityType={opportunityType}
          requirement={requirement}
        />
      )}

      {editable && requirement && (
        <AlertDialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("removeDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={removing} onClick={remove}>
                {removing ? t("removing") : t("remove")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
