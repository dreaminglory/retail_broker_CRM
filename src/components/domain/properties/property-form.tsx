"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import { SettlementCombobox } from "@/components/domain/settlements/settlement-combobox";
import { listAreasForSettlementAction } from "@/app/(dashboard)/properties/actions";
import type { Area } from "@/domain/areas/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { Property, PropertyType } from "@/domain/properties/types";
import type { Settlement } from "@/domain/settlements/types";
import {
  CONSTRUCTIONS,
  PROPERTY_TYPES,
  propertyFieldsFor,
  propertyFormSchema,
} from "@/domain/properties/validation";
import type { ActionResult } from "@/lib/actions";
import { NONE_SELECT_VALUE } from "@/lib/validation";

type AreaOption = Pick<Area, "id" | "name">;

type PropertyFormProps = {
  /** Pass when editing. Omit to create. */
  property?: Property;
  settlement?: Settlement | null;
  /** The settlement's active areas when editing, plus the property's own area. */
  areas?: AreaOption[];
  brokers: ActiveBroker[];
  defaultAssignee: string;
  action: (prevState: ActionResult<{ id: string }>, formData: FormData) => Promise<ActionResult<{ id: string }>>;
  onSuccess: (id: string) => void;
  onCancel?: () => void;
};

const initialState: ActionResult<{ id: string }> = { success: false, error: "" };

type FieldErrors = Record<string, string[] | undefined>;

export function PropertyForm({
  property,
  settlement: initialSettlement = null,
  areas: initialAreas = [],
  brokers,
  defaultAssignee,
  action,
  onSuccess,
  onCancel,
}: PropertyFormProps) {
  const t = useTranslations("PropertyForm");
  const enums = useTranslations("Enums");
  const tRoot = useTranslations();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<PropertyType>(property?.type ?? "apartment");
  const [areas, setAreas] = useState<AreaOption[]>(initialAreas);
  const [areaId, setAreaId] = useState<string>(property?.area_id ?? NONE_SELECT_VALUE);
  const [settlementId, setSettlementId] = useState<string | null>(initialSettlement?.id ?? null);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const [loadingAreas, startLoadingAreas] = useTransition();
  const fields = propertyFieldsFor(type);

  useEffect(() => {
    if (state.success) onSuccess(state.data.id);
  }, [state, onSuccess]);

  function pickSettlement(settlement: Settlement | null) {
    setSettlementId(settlement?.id ?? null);
    setAreaId(NONE_SELECT_VALUE);
    setAreas([]);
    if (!settlement) return;
    startLoadingAreas(async () => {
      const result = await listAreasForSettlementAction(settlement.id);
      setAreas(result.success ? result.data : []);
    });
  }

  // Rule 3 is checked here before the round trip, with the same schema the action uses.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = propertyFormSchema.safeParse(values);
    if (result.success) {
      setClientErrors(null);
      return;
    }
    event.preventDefault();
    const errors: FieldErrors = {};
    for (const [path, messages] of Object.entries(result.error.flatten().fieldErrors)) {
      errors[path] = messages?.map((key) => (tRoot.has(key as never) ? tRoot(key as never) : tRoot("validation.failed")));
    }
    setClientErrors(errors);
  }

  const serverErrors = !state.success ? state.fieldErrors : undefined;
  const errors: FieldErrors = clientErrors ?? serverErrors ?? {};
  const formError = !state.success && state.error && !state.fieldErrors && !clientErrors ? state.error : undefined;

  function errorFor(name: string) {
    const message = errors[name]?.[0];
    return message ? (
      <p id={`property-${name}-error`} className="text-xs text-destructive">
        {message}
      </p>
    ) : null;
  }

  function invalidProps(name: string) {
    const invalid = !!errors[name]?.length;
    return { "aria-invalid": invalid, "aria-describedby": invalid ? `property-${name}-error` : undefined };
  }

  function numberField(name: keyof Property, label: string, options: { required?: boolean; step?: string; min?: number; max?: number } = {}) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`property-${name}`}>
          {label}
          {options.required && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={`property-${name}`}
          name={name}
          type="number"
          inputMode={options.step ? "decimal" : "numeric"}
          step={options.step ?? "1"}
          min={options.min}
          max={options.max}
          required={options.required}
          defaultValue={(property?.[name] as number | null | undefined) ?? ""}
          {...invalidProps(name)}
        />
        {errorFor(name)}
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold">{t("attributes")}</legend>

        <div className="space-y-1.5">
          <Label htmlFor="property-type">
            {t("type")}
            <span className="text-destructive"> *</span>
          </Label>
          <Select name="type" value={type} onValueChange={(value) => setType(value as PropertyType)}>
            <SelectTrigger id="property-type" className="w-full sm:w-72">
              <SelectValue>{(value: string) => enums(`propertyType.${value}` as never)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {enums(`propertyType.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {fields.rooms && numberField("rooms", t("rooms"), { required: true, min: 1, max: 9 })}
          {fields.area_m2 && numberField("area_m2", t("areaM2"), { step: "0.01", min: 0 })}
          {fields.plot_m2 && numberField("plot_m2", t("plotM2"), { step: "0.01", min: 0, required: type === "plot" })}
          {fields.floor && numberField("floor", t("floor"), { min: -5, max: 200 })}
          {fields.floors_total && numberField("floors_total", t("floorsTotal"), { min: 1, max: 200 })}
          {fields.building && numberField("year_built", t("yearBuilt"), { min: 1800, max: 2100 })}
        </div>

        {fields.building && (
          <div className="space-y-1.5">
            <Label htmlFor="property-construction">{t("construction")}</Label>
            <Select name="construction" defaultValue={property?.construction ?? NONE_SELECT_VALUE}>
              <SelectTrigger id="property-construction" className="w-full sm:w-72">
                <SelectValue>
                  {(value: string) =>
                    value && value !== NONE_SELECT_VALUE ? enums(`construction.${value}` as never) : t("notSet")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_SELECT_VALUE} className="italic text-muted-foreground">
                  {t("notSet")}
                </SelectItem>
                {CONSTRUCTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {enums(`construction.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorFor("construction")}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold">{t("location")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="property-settlement">
              {t("settlement")}
              <span className="text-destructive"> *</span>
            </Label>
            <SettlementCombobox
              id="property-settlement"
              name="settlement_id"
              defaultValue={initialSettlement}
              onChange={pickSettlement}
              required
              invalid={!!errors.settlement_id?.length}
            />
            {errorFor("settlement_id")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="property-area">{t("area")}</Label>
            <Select
              name="area_id"
              value={areaId}
              onValueChange={(value) => setAreaId(value as string)}
              disabled={!settlementId || loadingAreas}
            >
              <SelectTrigger id="property-area" className="w-full" {...invalidProps("area_id")}>
                <SelectValue>
                  {(value: string) =>
                    areas.find((area) => area.id === value)?.name ?? (settlementId ? t("noArea") : t("pickSettlementFirst"))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_SELECT_VALUE} className="italic text-muted-foreground">
                  {t("noArea")}
                </SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {settlementId && !loadingAreas && areas.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("noAreasYet")}</p>
            )}
            {errorFor("area_id")}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="property-address">{t("address")}</Label>
          <Input
            id="property-address"
            name="address"
            maxLength={300}
            placeholder={t("addressPlaceholder")}
            defaultValue={property?.address ?? ""}
            {...invalidProps("address")}
          />
          {errorFor("address")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="property-location-note">{t("locationNote")}</Label>
          <Input
            id="property-location-note"
            name="location_note"
            maxLength={500}
            placeholder={t("locationNotePlaceholder")}
            defaultValue={property?.location_note ?? ""}
            {...invalidProps("location_note")}
          />
          {errorFor("location_note")}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold">{t("work")}</legend>
        <div className="space-y-1.5">
          <Label htmlFor="property-assigned-to">{t("assignedTo")}</Label>
          <div id="property-assigned-to" className="sm:w-72">
            <BrokerSelect
              name="assigned_to"
              brokers={brokers}
              defaultValue={property?.assigned_to ?? defaultAssignee}
              allowUnassigned={false}
              ariaLabel={t("assignedTo")}
            />
          </div>
          {errorFor("assigned_to")}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="property-description">{t("description")}</Label>
          <Textarea
            id="property-description"
            name="description"
            rows={4}
            maxLength={5000}
            defaultValue={property?.description ?? ""}
            {...invalidProps("description")}
          />
          {errorFor("description")}
        </div>
      </fieldset>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : property ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
