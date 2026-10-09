"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactImportField, InquiryImportField } from "@/domain/imports/types";
import { detectHeaders } from "@/domain/imports/csv/header-detection";

interface ColumnMappingTableProps {
  headers: string[];
  entityType: "contact" | "inquiry";
  initialMapping?: Record<string, string | null>;
  onChange: (mapping: Record<string, string | null>) => void;
}

const CONTACT_FIELD_OPTIONS: { value: ContactImportField; label: string }[] = [
  { value: "full_name", label: "Full Name" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "company_name", label: "Company Name" },
  { value: "contact_type", label: "Contact Type" },
  { value: "phone", label: "Phone" },
  { value: "phone_2", label: "Phone 2" },
  { value: "email", label: "Email" },
  { value: "email_2", label: "Email 2" },
  { value: "viber", label: "Viber" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "note", label: "Note" },
  { value: "external_ref", label: "External Reference ID" },
];

const INQUIRY_FIELD_OPTIONS: { value: InquiryImportField; label: string }[] = [
  { value: "caller_name", label: "Caller Name" },
  { value: "caller_phone", label: "Caller Phone" },
  { value: "caller_email", label: "Caller Email" },
  { value: "subject", label: "Subject" },
  { value: "description", label: "Description" },
  { value: "source", label: "Source" },
  { value: "external_ref", label: "External Reference ID" },
  { value: "received_at", label: "Date Received" },
  { value: "assigned_to", label: "Assigned To" },
  { value: "status", label: "Status" },
];

import { useTranslations } from "next-intl";

export function ColumnMappingTable({ headers, entityType, initialMapping, onChange }: ColumnMappingTableProps) {
  const t = useTranslations("SettingsImport.mapping");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  const fieldOptions = entityType === "inquiry" ? INQUIRY_FIELD_OPTIONS : CONTACT_FIELD_OPTIONS;

  useEffect(() => {
    if (initialMapping && Object.keys(initialMapping).length > 0) {
      setMapping(initialMapping);
      return;
    }

    const autoMapping = detectHeaders(headers);
    
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
              <TableCell className="font-medium">{t(`fields.${opt.value}` as any)}</TableCell>
              <TableCell>
                <Select
                  value={mapping[opt.value] || "none"}
                  onValueChange={(val) => handleMappingChange(opt.value, val as string | null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("doNotImport")} />
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
