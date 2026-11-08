"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContactImportField, InquiryImportField, PropertyImportField } from "@/domain/imports/types";
import { REQUIRED_MAPPING_FIELDS } from "@/domain/imports/validation";
import { detectHeaders } from "@/domain/imports/csv/header-detection";
import { sampleValue } from "@/domain/imports/csv/sample-value";

interface ColumnMappingTableProps {
  headers: string[];
  entityType: "contact" | "inquiry" | "property";
  /** The first data rows of the file, for a sample value per mapped column. */
  sampleRows?: string[][];
  initialMapping?: Record<string, string | null>;
  onChange: (mapping: Record<string, string | null>) => void;
}

const CONTACT_FIELD_OPTIONS: { value: ContactImportField }[] = [
  { value: "full_name" },
  { value: "first_name" },
  { value: "last_name" },
  { value: "company_name" },
  { value: "contact_type" },
  { value: "phone" },
  { value: "phone_2" },
  { value: "email" },
  { value: "email_2" },
  { value: "viber" },
  { value: "whatsapp" },
  { value: "note" },
  { value: "external_ref" },
];

const INQUIRY_FIELD_OPTIONS: { value: InquiryImportField }[] = [
  { value: "caller_name" },
  { value: "caller_phone" },
  { value: "caller_email" },
  { value: "subject" },
  { value: "description" },
  { value: "source" },
  { value: "external_ref" },
  { value: "received_at" },
  { value: "assigned_to" },
  { value: "status" },
];

// The spec's Columns table order.
const PROPERTY_FIELD_OPTIONS: { value: PropertyImportField }[] = ([
  "type", "settlement", "municipality", "province", "area", "address", "location_note",
  "rooms", "area_m2", "plot_m2", "floor", "floors_total", "year_built", "construction",
  "sale_price", "rent_price", "listing_status", "listed_at", "assigned_to", "description",
  "external_ref", "owner_name", "owner_phone", "owner_email",
] as const).map((value) => ({ value }));

const FIELD_OPTIONS = {
  contact: CONTACT_FIELD_OPTIONS,
  inquiry: INQUIRY_FIELD_OPTIONS,
  property: PROPERTY_FIELD_OPTIONS,
};

import { useTranslations } from "next-intl";

export function ColumnMappingTable({ headers, entityType, sampleRows = [], initialMapping, onChange }: ColumnMappingTableProps) {
  const t = useTranslations("SettingsImport.mapping");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  const fieldOptions: { value: string }[] = FIELD_OPTIONS[entityType];
  const required = new Set<string>(REQUIRED_MAPPING_FIELDS[entityType]);

  useEffect(() => {
    if (initialMapping && Object.keys(initialMapping).length > 0) {
      setMapping(initialMapping);
      return;
    }

    const autoMapping = detectHeaders(headers, entityType);
    
    // Ensure all fields exist in mapping, even if null
    const fullMapping: Record<string, string | null> = {};
    fieldOptions.forEach(opt => {
      fullMapping[opt.value] = autoMapping[opt.value] || null;
    });

    setMapping(fullMapping);
    onChange(fullMapping);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, entityType]);

  const handleMappingChange = (field: string, headerValue: string | null) => {
    const newMapping = { ...mapping, [field]: headerValue === "none" ? null : headerValue };
    setMapping(newMapping);
    onChange(newMapping);
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/2">{t("crmField")}</TableHead>
            <TableHead className="w-1/2">{t("csvColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fieldOptions.map((opt) => (
            <TableRow key={opt.value}>
              <TableCell className="font-medium align-top whitespace-normal">
                {t(`fields.${opt.value}` as any)}
                {required.has(opt.value) && (
                  <span className="text-destructive ml-0.5" title={t("required")} aria-label={t("required")}>*</span>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={mapping[opt.value] || "none"}
                  onValueChange={(val) => handleMappingChange(opt.value, val as string | null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("doNotImport")}>
                      {(value) => (value && value !== "none" ? value : t("doNotImport"))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("doNotImport")}</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const sample = sampleValue(headers, sampleRows, mapping[opt.value] ?? null);
                  return sample ? (
                    <p className="mt-1 text-xs text-muted-foreground truncate max-w-[16rem]" title={sample}>
                      {t("sample", { value: sample })}
                    </p>
                  ) : null;
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
