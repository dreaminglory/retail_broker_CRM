"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InquiryImportOptionsInput } from "@/domain/imports/validation";

interface InquiryImportOptionsFormProps {
  options: InquiryImportOptionsInput;
  onChange: (options: InquiryImportOptionsInput) => void;
}

import { useTranslations } from "next-intl";

export function InquiryImportOptionsForm({ options, onChange }: InquiryImportOptionsFormProps) {
  const t = useTranslations("SettingsImport.options");
  return (
    <div className="space-y-6">
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("contactLinking.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("contactLinking.desc")}
        </p>
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox"
            id="link_contacts" 
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={options.link_contacts}
            onChange={(e) => onChange({ ...options, link_contacts: e.target.checked })}
          />
          <Label htmlFor="link_contacts">{t("contactLinking.link")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox"
            id="create_missing_contacts" 
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            checked={options.create_missing_contacts}
            onChange={(e) => onChange({ ...options, create_missing_contacts: e.target.checked })}
          />
          <Label htmlFor="create_missing_contacts">{t("contactLinking.create")}</Label>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("unknownSource.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("unknownSource.desc")}
        </p>
        <RadioGroup
          value={options.unknown_source}
          onValueChange={(val: "error" | "use_default") =>
            onChange({ ...options, unknown_source: val })
          }
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="error" id="error" />
            <Label htmlFor="error">{t("unknownSource.error")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="use_default" id="use_default" />
            <Label htmlFor="use_default">{t("unknownSource.useDefault")}</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-medium">{t("defaultStatus.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("defaultStatus.desc")}
        </p>
        <Select 
          value={options.default_status} 
          onValueChange={(val: any) => onChange({ ...options, default_status: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">{t("defaultStatus.new")}</SelectItem>
            <SelectItem value="contacted">{t("defaultStatus.contacted")}</SelectItem>
            <SelectItem value="converted">{t("defaultStatus.converted")}</SelectItem>
            <SelectItem value="dismissed">{t("defaultStatus.dismissed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
