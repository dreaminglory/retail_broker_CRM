"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactImportField } from "@/domain/imports/types";
import { detectHeaders } from "@/domain/imports/csv/header-detection";

interface ColumnMappingTableProps {
  headers: string[];
  initialMapping?: Record<string, string | null>;
  onChange: (mapping: Record<string, string | null>) => void;
}

const FIELD_OPTIONS: { value: ContactImportField; label: string }[] = [
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

export function ColumnMappingTable({ headers, initialMapping, onChange }: ColumnMappingTableProps) {
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (initialMapping && Object.keys(initialMapping).length > 0) {
      setMapping(initialMapping);
      return;
    }

    const autoMapping = detectHeaders(headers);
    // Convert from Field -> Header to Field -> Header 
    // Wait, the mapping in DB is Field -> Header.
    // e.g., mapping["first_name"] = "Име"
    
    // Ensure all fields exist in mapping, even if null
    const fullMapping: Record<string, string | null> = {};
    FIELD_OPTIONS.forEach(opt => {
      fullMapping[opt.value] = autoMapping[opt.value] || null;
    });

    setMapping(fullMapping);
    onChange(fullMapping);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

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
            <TableHead className="w-1/2">CRM Field</TableHead>
            <TableHead className="w-1/2">CSV Column</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FIELD_OPTIONS.map((opt) => (
            <TableRow key={opt.value}>
              <TableCell className="font-medium">{opt.label}</TableCell>
              <TableCell>
                <Select
                  value={mapping[opt.value] || "none"}
                  onValueChange={(val) => handleMappingChange(opt.value, val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Do not import" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Do not import --</SelectItem>
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
