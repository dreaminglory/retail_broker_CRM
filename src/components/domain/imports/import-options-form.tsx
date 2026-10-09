"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ContactImportOptionsInput } from "@/domain/imports/validation";

interface ImportOptionsFormProps {
  options: ContactImportOptionsInput;
  onChange: (options: ContactImportOptionsInput) => void;
}

import { useTranslations } from "next-intl";

export function ImportOptionsForm({ options, onChange }: ImportOptionsFormProps) {
  const t = useTranslations("SettingsImport.options");
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t("duplicateStrategy.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("duplicateStrategy.desc")}
        </p>
        <RadioGroup
          value={options.duplicate_strategy}
          onValueChange={(val: "skip" | "update" | "create") =>
            onChange({ ...options, duplicate_strategy: val })
          }
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="skip" id="skip" />
            <Label htmlFor="skip">{t("duplicateStrategy.skip")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="update" id="update" />
            <Label htmlFor="update">{t("duplicateStrategy.update")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="create" id="create" />
            <Label htmlFor="create">{t("duplicateStrategy.create")}</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("defaultContactType.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("defaultContactType.desc")}
        </p>
        <RadioGroup
          value={options.default_contact_type}
          onValueChange={(val: "person" | "organization") =>
            onChange({ ...options, default_contact_type: val })
          }
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="person" id="person" />
            <Label htmlFor="person">{t("defaultContactType.person")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="organization" id="organization" />
            <Label htmlFor="organization">{t("defaultContactType.organization")}</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
