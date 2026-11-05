"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveRequirementAction } from "@/app/(dashboard)/opportunities/[id]/requirement/actions";
import type { OpportunityType } from "@/domain/opportunities/types";
import type { Construction, PropertyType } from "@/domain/properties/types";
import { CONSTRUCTIONS, PROPERTY_TYPES } from "@/domain/properties/validation";
import type { Financing, MustCriterion, Requirement, RequirementLocation } from "@/domain/requirements/types";
import {
  FINANCINGS,
  applyDefaultMust,
  criterionIsSet,
  requirementInputSchema,
  type MustFlags,
} from "@/domain/requirements/validation";
import { LocationPicker, ToggleChip } from "./location-picker";

type Values = {
  budget_min: string;
  budget_max: string;
  rooms_min: string;
  rooms_max: string;
  area_m2_min: string;
  area_m2_max: string;
  floor_min: string;
  floor_max: string;
  not_top_floor: boolean;
  property_types: PropertyType[];
  construction: Construction[];
  locations: RequirementLocation[];
  financing: Financing;
  wishes: string;
};

type Range = "budget" | "rooms" | "area_m2" | "floor";

type FieldErrors = Record<string, string[] | undefined>;

const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function initialValues(requirement: Requirement | null): Values {
  return {
    budget_min: text(requirement?.budget_min),
    budget_max: text(requirement?.budget_max),
    rooms_min: text(requirement?.rooms_min),
    rooms_max: text(requirement?.rooms_max),
    area_m2_min: text(requirement?.area_m2_min),
    area_m2_max: text(requirement?.area_m2_max),
    floor_min: text(requirement?.floor_min),
    floor_max: text(requirement?.floor_max),
    not_top_floor: requirement?.not_top_floor ?? false,
    property_types: requirement?.property_types ?? [],
    construction: requirement?.construction ?? [],
    locations: requirement?.locations ?? [],
    financing: requirement?.financing ?? "unknown",
    wishes: requirement?.wishes ?? "",
  };
}

function initialFlags(requirement: Requirement | null): MustFlags {
  return {
    budget_must: requirement?.budget_must ?? false,
    location_must: requirement?.location_must ?? false,
    type_must: requirement?.type_must ?? false,
    rooms_must: requirement?.rooms_must ?? false,
    area_m2_must: requirement?.area_m2_must ?? false,
    floor_must: requirement?.floor_must ?? false,
    construction_must: requirement?.construction_must ?? false,
  };
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);

type RequirementFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityType: OpportunityType;
  requirement: Requirement | null;
};

/** The form in a sheet: full width on a phone, a wide panel from the right on a desktop. */
export function RequirementFormSheet({ open, onOpenChange, ...props }: RequirementFormSheetProps) {
  const t = useTranslations("RequirementForm");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{t(props.requirement ? "editTitle" : "addTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        {open && <RequirementForm {...props} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

type RequirementFormProps = {
  opportunityId: string;
  opportunityType: OpportunityType;
  requirement: Requirement | null;
  onDone: () => void;
  onCancel: () => void;
};

/**
 * Budget, where, what and extra (spec: requirements, Screens). Each matchable criterion has a
 * must-have switch, usable once it is filled; budget, location and type switch on when first
 * filled (rule 4).
 */
export function RequirementForm({ opportunityId, opportunityType, requirement, onDone, onCancel }: RequirementFormProps) {
  const t = useTranslations("RequirementForm");
  const tRoot = useTranslations();
  const enums = useTranslations("Enums");
  const [values, setValues] = useState<Values>(() => initialValues(requirement));
  const [flags, setFlags] = useState<MustFlags>(() => initialFlags(requirement));
  const [switched, setSwitched] = useState<ReadonlySet<MustCriterion>>(() => new Set());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<Values>) {
    const next = { ...values, ...patch };
    setFlags(applyDefaultMust(values, next, flags, switched));
    setValues(next);
  }

  function setMust(criterion: MustCriterion, checked: boolean) {
    setSwitched(new Set([...switched, criterion]));
    setFlags({ ...flags, [`${criterion}_must`]: checked });
  }

  const translate = (key: string) => (tRoot.has(key as never) ? tRoot(key as never) : tRoot("validation.failed"));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      ...values,
      ...flags,
      locations: values.locations.map(({ settlement_id, area_id }) => ({ settlement_id, area_id })),
    };

    // The same schema the action uses, before the round trip.
    const parsed = requirementInputSchema.safeParse(input);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      setErrors(Object.fromEntries(Object.entries(flat.fieldErrors).map(([path, keys]) => [path, keys?.map(translate)])));
      setFormError(flat.formErrors[0] ? translate(flat.formErrors[0]) : null);
      return;
    }
    setErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await saveRequirementAction(opportunityId, input);
      if (result.success) {
        toast.success(t("saved"));
        onDone();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) setErrors(result.fieldErrors);
      toast.error(result.error);
    });
  }

  const errorId = (name: string) => `requirement-${name}-error`;
  const errorFor = (name: string) =>
    errors[name]?.[0] ? (
      <p id={errorId(name)} className="text-xs text-destructive">
        {errors[name]![0]}
      </p>
    ) : null;
  const invalidProps = (name: string) => {
    const invalid = !!errors[name]?.length;
    return { "aria-invalid": invalid, "aria-describedby": invalid ? errorId(name) : undefined };
  };

  function mustSwitch(criterion: MustCriterion, label: string) {
    const key = `${criterion}_must` as const;
    const enabled = criterionIsSet(values, criterion);
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={flags[key]}
          disabled={!enabled}
          onCheckedChange={(checked) => setMust(criterion, checked)}
          aria-label={t("mustHaveOf", { criterion: label })}
        />
        <span aria-hidden className={enabled ? "text-xs" : "text-xs text-muted-foreground"}>
          {t("mustHave")}
        </span>
      </div>
    );
  }

  function rangeField(
    range: Range,
    legend: string,
    options: { decimal?: boolean; min?: number; max?: number; hint?: ReactNode; extra?: ReactNode },
  ) {
    const input = (bound: "min" | "max") => {
      const name = `${range}_${bound}` as const;
      return (
        <div className="space-y-1">
          <Label htmlFor={`requirement-${name}`} className="text-xs font-normal text-muted-foreground">
            {t(bound === "min" ? "from" : "to")}
          </Label>
          <Input
            id={`requirement-${name}`}
            type="number"
            inputMode={options.decimal ? "decimal" : "numeric"}
            step={options.decimal ? "any" : "1"}
            min={options.min}
            max={options.max}
            value={values[name]}
            onChange={(event) => update({ [name]: event.target.value })}
            {...invalidProps(name)}
          />
          {errorFor(name)}
        </div>
      );
    };
    const criterion: MustCriterion = range;
    const groupId = `requirement-${range}-label`;
    return (
      <div role="group" aria-labelledby={groupId} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={groupId} className="text-sm font-medium">{legend}</span>
          {mustSwitch(criterion, legend)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {input("min")}
          {input("max")}
        </div>
        {options.extra}
        {options.hint}
        {errorFor(`${criterion}_must`)}
      </div>
    );
  }

  function chips<T extends string>(
    criterion: "type" | "construction",
    legend: string,
    options: readonly T[],
    selected: T[],
    label: (value: T) => string,
    onChange: (next: T[]) => void,
  ) {
    const groupId = `requirement-${criterion}-label`;
    return (
      <div role="group" aria-labelledby={groupId} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={groupId} className="text-sm font-medium">{legend}</span>
          {mustSwitch(criterion, legend)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <ToggleChip key={option} pressed={selected.includes(option)} onClick={() => onChange(toggle(selected, option))}>
              {label(option)}
            </ToggleChip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("anyHint")}</p>
        {errorFor(criterion === "type" ? "property_types" : "construction")}
        {errorFor(`${criterion}_must`)}
      </div>
    );
  }

  const budgetLabel = t(opportunityType === "tenant" ? "budgetRent" : "budgetPrice");

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8 p-4">
      {formError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <section className="space-y-4" aria-labelledby="requirement-budget-group">
        <h3 id="requirement-budget-group" className="text-base font-semibold">{t("budgetGroup")}</h3>
        {rangeField("budget", budgetLabel, { decimal: true, min: 0 })}
      </section>

      <section className="space-y-4" aria-labelledby="requirement-where-group">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="requirement-where-group" className="text-base font-semibold">{t("whereGroup")}</h3>
          {mustSwitch("location", t("whereGroup"))}
        </div>
        <LocationPicker
          id="requirement-location"
          value={values.locations}
          onChange={(locations) => update({ locations })}
          invalid={!!errors.locations?.length}
          describedBy="requirement-location-hint"
        />
        {errorFor("locations")}
        {errorFor("location_must")}
      </section>

      <section className="space-y-6" aria-labelledby="requirement-what-group">
        <h3 id="requirement-what-group" className="text-base font-semibold">{t("whatGroup")}</h3>
        {chips("type", t("types"), PROPERTY_TYPES, values.property_types, (value) => enums(`propertyType.${value}`), (property_types) =>
          update({ property_types }),
        )}
        {rangeField("rooms", t("rooms"), { min: 1, max: 9 })}
        {rangeField("area_m2", t("areaM2"), { decimal: true, min: 0 })}
        {rangeField("floor", t("floor"), {
          min: -5,
          max: 200,
          extra: (
            <div className="flex items-center gap-2">
              <Switch
                id="requirement-not_top_floor"
                checked={values.not_top_floor}
                onCheckedChange={(checked) => update({ not_top_floor: checked })}
                aria-labelledby="requirement-not_top_floor-label"
              />
              <span id="requirement-not_top_floor-label" className="text-sm">
                {t("notTopFloor")}
              </span>
            </div>
          ),
          hint: <p className="text-xs text-muted-foreground">{tRoot("ui.floorHint")}</p>,
        })}
        {chips("construction", t("construction"), CONSTRUCTIONS, values.construction, (value) => enums(`construction.${value}`), (construction) =>
          update({ construction }),
        )}
      </section>

      <section className="space-y-4" aria-labelledby="requirement-extra-group">
        <h3 id="requirement-extra-group" className="text-base font-semibold">{t("extraGroup")}</h3>
        <div className="space-y-1.5">
          <Label htmlFor="requirement-financing">{t("financing")}</Label>
          <Select value={values.financing} onValueChange={(value) => update({ financing: value as Financing })}>
            <SelectTrigger id="requirement-financing" className="w-full sm:w-72">
              <SelectValue>{(value: string) => enums(`financing.${value}` as never)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FINANCINGS.map((value) => (
                <SelectItem key={value} value={value}>
                  {enums(`financing.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="requirement-wishes">{t("wishes")}</Label>
          <Textarea
            id="requirement-wishes"
            rows={3}
            maxLength={2000}
            placeholder={t("wishesPlaceholder")}
            value={values.wishes}
            onChange={(event) => update({ wishes: event.target.value })}
            {...invalidProps("wishes")}
          />
          {errorFor("wishes")}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
