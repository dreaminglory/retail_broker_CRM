"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { describeRowError } from "@/domain/imports/row-error";
import type { PreviewRow, PropertyPreview } from "@/domain/imports/property-preview";
import type { DuplicateStrategy } from "@/domain/imports/types";

type PropertyImportPreviewProps = {
  jobId: string;
  preview: PropertyPreview;
  duplicateStrategy: DuplicateStrategy;
  /** The keys of the new areas the user keeps; the commit creates only these. */
  keptAreas: Set<string>;
  onToggleArea: (key: string, keep: boolean) => void;
};

const ROW_FILTERS = ["all", "valid", "duplicate", "invalid", "skipped"] as const;
type RowFilter = (typeof ROW_FILTERS)[number];

/** Rendering 5,000 rows at once is slow; the error CSV has every invalid row. */
const MAX_ROWS_SHOWN = 200;

export function PropertyImportPreview({ jobId, preview, duplicateStrategy, keptAreas, onToggleArea }: PropertyImportPreviewProps) {
  const t = useTranslations("SettingsImport.propertyPreview");
  const tAll = useTranslations();
  const [filter, setFilter] = useState<RowFilter>("all");

  const reason = (code: string) => (tAll.has(code as never) ? tAll(code as never) : tAll("errors.unexpected"));
  const outcome = (row: PreviewRow) => {
    if (row.status === "duplicate") return row.matchReason === "in_file" ? t("outcome.duplicateInFile") : t("outcome.duplicate");
    if (row.status === "skipped") return t("outcome.skipped");
    if (row.status === "invalid") return t("outcome.invalid");
    return t("outcome.valid");
  };
  const outcomeClass = (row: PreviewRow) =>
    row.status === "invalid" ? "text-red-700" : row.status === "valid" ? "text-green-700" : "text-yellow-700";
  const notes = (row: PreviewRow) => [...row.errors, ...row.warnings].map((e) => describeRowError(e, reason));

  const filtered = filter === "all" ? preview.rows : preview.rows.filter((r) => r.status === filter);
  const shown = filtered.slice(0, MAX_ROWS_SHOWN);

  const tiles = [
    { key: "new", value: preview.counts.new, className: "bg-green-50 text-green-700" },
    { key: "duplicate", value: preview.counts.duplicate, className: "bg-yellow-50 text-yellow-700" },
    { key: "invalid", value: preview.counts.invalid, className: "bg-red-50 text-red-700" },
    { key: "skipped", value: preview.counts.skipped, className: "bg-muted text-muted-foreground" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {tiles.map((tile) => (
          <div key={tile.key} className={`p-4 border rounded-md ${tile.className}`}>
            <div className="text-2xl font-bold">{tile.value}</div>
            <div className="text-sm">{t(`counts.${tile.key}`)}</div>
          </div>
        ))}
      </div>

      <ul className="text-sm space-y-1 text-muted-foreground">
        <li>{t(duplicateStrategy === "create" ? "strategy.create" : "strategy.skip")}</li>
        <li>{t("owners", { matched: preview.owners.matched, created: preview.owners.created })}</li>
        {preview.bgnConverted > 0 && <li>{t("bgnConverted", { count: preview.bgnConverted })}</li>}
      </ul>

      {preview.newAreas.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">{t("newAreas.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("newAreas.desc")}</p>
          </div>
          <ul className="border rounded-md divide-y">
            {preview.newAreas.map((area) => {
              const id = `area-${area.key}`;
              return (
                <li key={area.key} className="p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={id}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                      checked={keptAreas.has(area.key)}
                      onChange={(e) => onToggleArea(area.key, e.target.checked)}
                    />
                    <Label htmlFor={id} className="flex-1 flex flex-wrap justify-between gap-x-3 font-normal">
                      <span>
                        <span className="font-medium">{area.name}</span>
                        <span className="text-muted-foreground ml-2">{area.settlementName}</span>
                      </span>
                      <span className="text-muted-foreground">{t("newAreas.rows", { count: area.rows })}</span>
                    </Label>
                  </div>
                  {area.similarTo && (
                    <p className="ml-6 text-xs text-yellow-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {t("newAreas.similar", { name: area.similarTo })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{t("newAreas.unticked")}</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-medium">{t("rows.title")}</h3>
          <div className="flex items-center gap-2">
            {preview.counts.invalid > 0 && (
              <Button
                variant="link"
                className="px-0"
                onClick={() => window.open(`/settings/import/${jobId}/errors.csv`, "_blank")}
              >
                {t("rows.downloadErrors")}
              </Button>
            )}
            <Select value={filter} onValueChange={(value) => setFilter((value as RowFilter) ?? "all")}>
              <SelectTrigger className="w-44" aria-label={t("rows.filter")}>
                <SelectValue>{(value) => t(`rows.filters.${value as RowFilter}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROW_FILTERS.map((f) => (
                  <SelectItem key={f} value={f}>{t(`rows.filters.${f}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden md:block border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t("rows.row")}</TableHead>
                <TableHead>{t("rows.property")}</TableHead>
                <TableHead className="w-48">{t("rows.outcome")}</TableHead>
                <TableHead>{t("rows.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell className="whitespace-normal">{row.label}</TableCell>
                  <TableCell className={outcomeClass(row)}>{outcome(row)}</TableCell>
                  <TableCell className="whitespace-normal text-sm">{notes(row).join(" ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="md:hidden space-y-2">
          {shown.map((row) => (
            <li key={row.rowNumber} className="border rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t("rows.rowNumber", { row: row.rowNumber })}</span>
                <span className={`font-medium ${outcomeClass(row)}`}>{outcome(row)}</span>
              </div>
              <div>{row.label}</div>
              {notes(row).map((note) => (
                <p key={note} className="text-xs text-muted-foreground">{note}</p>
              ))}
            </li>
          ))}
        </ul>

        {filtered.length > shown.length && (
          <p className="text-xs text-muted-foreground">{t("rows.showingFirst", { shown: shown.length, total: filtered.length })}</p>
        )}
      </section>
    </div>
  );
}
