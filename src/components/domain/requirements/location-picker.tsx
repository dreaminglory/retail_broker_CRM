"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettlementCombobox } from "@/components/domain/settlements/settlement-combobox";
import { listAreasForSettlementAction } from "@/app/(dashboard)/properties/actions";
import type { Area } from "@/domain/areas/types";
import type { RequirementLocation } from "@/domain/requirements/types";
import type { Settlement } from "@/domain/settlements/types";
import { cn } from "@/lib/utils";

type LocationPickerProps = {
  id: string;
  value: RequirementLocation[];
  onChange: (locations: RequirementLocation[]) => void;
  invalid?: boolean;
  describedBy?: string;
};

const keyOf = (location: Pick<RequirementLocation, "settlement_id" | "area_id">) =>
  `${location.settlement_id}:${location.area_id ?? ""}`;

/**
 * Settlements and, in each, several of the agency's active areas (rule 6). Choosing the whole
 * settlement replaces its areas and choosing an area replaces the whole settlement, since the
 * whole settlement already covers them. An area deactivated since stays until removed.
 */
export function LocationPicker({ id, value, onChange, invalid, describedBy }: LocationPickerProps) {
  const t = useTranslations("RequirementLocationPicker");
  const tRequirements = useTranslations("requirements");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [areas, setAreas] = useState<Pick<Area, "id" | "name">[]>([]);
  const [loading, startLoading] = useTransition();
  // Remounts the combobox to clear it after a settlement is closed.
  const [pickerKey, setPickerKey] = useState(0);

  const chosen = new Set(value.map(keyOf));

  function pickSettlement(next: Settlement | null) {
    setSettlement(next);
    setAreas([]);
    if (!next) return;
    startLoading(async () => {
      const result = await listAreasForSettlementAction(next.id);
      setAreas(result.success ? result.data : []);
    });
  }

  function toggleWhole(current: Settlement) {
    const key = keyOf({ settlement_id: current.id, area_id: null });
    if (chosen.has(key)) {
      onChange(value.filter((location) => keyOf(location) !== key));
      return;
    }
    onChange([
      ...value.filter((location) => location.settlement_id !== current.id),
      { settlement_id: current.id, settlement_name: current.name, area_id: null, area_name: null, area_active: null },
    ]);
  }

  function toggleArea(current: Settlement, area: Pick<Area, "id" | "name">) {
    const key = keyOf({ settlement_id: current.id, area_id: area.id });
    if (chosen.has(key)) {
      onChange(value.filter((location) => keyOf(location) !== key));
      return;
    }
    onChange([
      ...value.filter((location) => !(location.settlement_id === current.id && location.area_id === null)),
      { settlement_id: current.id, settlement_name: current.name, area_id: area.id, area_name: area.name, area_active: true },
    ]);
  }

  const several = new Set(value.map((location) => location.settlement_id)).size > 1;
  const label = (location: RequirementLocation) =>
    location.area_name
      ? several
        ? tRequirements("areaInSettlement", { area: location.area_name, settlement: location.settlement_name })
        : location.area_name
      : location.settlement_name;

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("settlement")}>
          {value.map((location) => (
            <li key={keyOf(location)}>
              <Badge variant="secondary" className="h-7 gap-1 pr-0.5 font-normal">
                {label(location)}
                {location.area_active === false && <span className="text-muted-foreground">· {t("inactiveArea")}</span>}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onChange(value.filter((item) => keyOf(item) !== keyOf(location)))}
                  aria-label={t("remove", { name: label(location) })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={id}>{t("settlement")}</Label>
        <SettlementCombobox key={pickerKey} id={id} onChange={pickSettlement} invalid={invalid} />
        <p id={describedBy} className="text-xs text-muted-foreground">
          {t("pickHint")}
        </p>
      </div>

      {settlement && (
        <fieldset className="space-y-2 rounded-md border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">{t("areas", { settlement: settlement.name })}</legend>
          <div className="flex flex-wrap gap-1.5">
            <ToggleChip
              pressed={chosen.has(keyOf({ settlement_id: settlement.id, area_id: null }))}
              onClick={() => toggleWhole(settlement)}
            >
              {t("wholeSettlement")}
            </ToggleChip>
            {areas.map((area) => (
              <ToggleChip
                key={area.id}
                pressed={chosen.has(keyOf({ settlement_id: settlement.id, area_id: area.id }))}
                onClick={() => toggleArea(settlement, area)}
              >
                {area.name}
              </ToggleChip>
            ))}
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground">{t("loadingAreas")}</p>
          ) : (
            areas.length === 0 && <p className="text-xs text-muted-foreground">{t("noAreas")}</p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSettlement(null);
                setAreas([]);
                setPickerKey((key) => key + 1);
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("done")}
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

/** A pressed / not pressed chip for a multi-choice list. */
export function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
