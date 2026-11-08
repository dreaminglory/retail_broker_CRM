"use client";

import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROPERTY_DATE_FORMATS, type PropertyImportOptionsInput } from "@/domain/imports/validation";

export type ImportBrokerOption = { id: string; name: string };

type PropertyImportOptionsFormProps = {
  options: PropertyImportOptionsInput;
  brokers: ImportBrokerOption[];
  onChange: (options: PropertyImportOptionsInput) => void;
};

const NO_DEFAULT = "importer";

export function PropertyImportOptionsForm({ options, brokers, onChange }: PropertyImportOptionsFormProps) {
  const t = useTranslations("SettingsImport.options");
  const brokerName = (id: string | null | undefined) =>
    brokers.find((b) => b.id === id)?.name ?? t("defaultBroker.importer");

  return (
    <div className="space-y-6">
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("duplicateStrategy.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("propertyDuplicates.desc")}</p>
        <RadioGroup
          value={options.duplicate_strategy}
          onValueChange={(val: "skip" | "create") => onChange({ ...options, duplicate_strategy: val })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="skip" id="property-skip" />
            <Label htmlFor="property-skip">{t("duplicateStrategy.skip")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="create" id="property-create" />
            <Label htmlFor="property-create">{t("duplicateStrategy.create")}</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("defaultBroker.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("defaultBroker.desc")}</p>
        <Select
          value={options.default_assigned_to ?? NO_DEFAULT}
          onValueChange={(val) =>
            onChange({ ...options, default_assigned_to: !val || val === NO_DEFAULT ? null : (val as string) })
          }
        >
          <SelectTrigger aria-label={t("defaultBroker.title")}>
            <SelectValue>{(value) => (value === NO_DEFAULT ? t("defaultBroker.importer") : brokerName(value as string))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>{t("defaultBroker.importer")}</SelectItem>
            {brokers.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("dateFormat.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("dateFormat.desc")}</p>
        <Select
          value={options.date_format ?? PROPERTY_DATE_FORMATS[0]}
          onValueChange={(val) =>
            onChange({ ...options, date_format: val as PropertyImportOptionsInput["date_format"] })
          }
        >
          <SelectTrigger aria-label={t("dateFormat.title")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_DATE_FORMATS.map((format) => (
              <SelectItem key={format} value={format}>{format}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
