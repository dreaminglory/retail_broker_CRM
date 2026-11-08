// spec: property-import, "Preview". Built from the validated rows, without touching them.

import { findSimilarArea } from './area-similarity';
import type { NewOwner, NormalizedPropertyRow } from './property-validation';
import type { DuplicateStrategy, ImportError, ImportRow } from './types';

export type PreviewInputRow = Pick<ImportRow, 'row_number' | 'status' | 'match_reason' | 'errors' | 'raw' | 'normalized'>;

type NormalizedPreviewRow = Partial<NormalizedPropertyRow> & {
  owner_contact_id?: string | null;
  new_owner?: NewOwner | null;
  warnings?: ImportError[];
};

export type PreviewNewArea = {
  /** `settlement_id:name`, the value saved in `options.create_areas`. */
  key: string;
  name: string;
  settlementName: string;
  rows: number;
  /** An existing area of the same settlement this name may be a typo of (rule 3). */
  similarTo: string | null;
  checked: boolean;
};

export type PreviewRow = {
  rowNumber: number;
  status: ImportRow['status'];
  matchReason: ImportRow['match_reason'];
  /** Type, settlement and address as written in the file. */
  label: string;
  errors: ImportError[];
  warnings: ImportError[];
};

export type PropertyPreview = {
  counts: { new: number; duplicate: number; invalid: number; skipped: number };
  newAreas: PreviewNewArea[];
  /** Rows whose prices were converted from BGN (Q1). */
  bgnConverted: number;
  owners: { matched: number; created: number };
  rows: PreviewRow[];
};

export type PropertyPreviewContext = {
  mapping: Record<string, string | null>;
  duplicateStrategy: DuplicateStrategy;
  /** `options.create_areas`; absent means every new area is kept. */
  createAreas: string[] | undefined;
  settlementNames: Map<string, string>;
  /** Existing area names of the agency per settlement, active or not. */
  existingAreas: Map<string, string[]>;
};

export function buildPropertyPreview(rows: PreviewInputRow[], ctx: PropertyPreviewContext): PropertyPreview {
  const counts = { new: 0, duplicate: 0, invalid: 0, skipped: 0 };
  const areas = new Map<string, PreviewNewArea>();
  const owners = { matched: new Set<string>(), created: 0 };
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  let bgnConverted = 0;
  const kept = ctx.createAreas ? new Set(ctx.createAreas) : null;

  const label = (raw: Record<string, string>) =>
    (['type', 'settlement', 'address'] as const)
      .map((field) => ctx.mapping[field])
      .map((header) => (header ? raw[header]?.trim() : ''))
      .filter(Boolean)
      .join(', ');

  const previewRows = rows.map((row): PreviewRow => {
    if (row.status === 'valid') counts.new++;
    else if (row.status === 'duplicate') counts.duplicate++;
    else if (row.status === 'invalid') counts.invalid++;
    else if (row.status === 'skipped') counts.skipped++;

    const normalized = row.normalized as NormalizedPreviewRow | null;
    // The rows import_commit_properties writes.
    const written = row.status === 'valid' || (row.status === 'duplicate' && ctx.duplicateStrategy === 'create');
    if (written && normalized) {
      if (normalized.bgn_converted) bgnConverted++;

      const area = normalized.new_area;
      if (area) {
        const existing = areas.get(area.key);
        if (existing) existing.rows++;
        else {
          areas.set(area.key, {
            key: area.key,
            name: area.name,
            settlementName: ctx.settlementNames.get(area.settlement_id) ?? '',
            rows: 1,
            similarTo: findSimilarArea(area.name, ctx.existingAreas.get(area.settlement_id) ?? []),
            checked: kept ? kept.has(area.key) : true,
          });
        }
      }

      // The commit re-matches a new owner by phone, then email, against the owners it made earlier.
      if (normalized.owner_contact_id) owners.matched.add(normalized.owner_contact_id);
      else if (normalized.new_owner) {
        const { phone, email } = normalized.new_owner;
        const earlier = (phone && seenPhones.has(phone)) || (email && seenEmails.has(email));
        if (!earlier) owners.created++;
        if (phone) seenPhones.add(phone);
        if (email) seenEmails.add(email);
      }
    }

    return {
      rowNumber: row.row_number,
      status: row.status,
      matchReason: row.match_reason,
      label: label(row.raw),
      errors: row.errors ?? [],
      warnings: normalized?.warnings ?? [],
    };
  });

  return {
    counts,
    newAreas: [...areas.values()],
    bgnConverted,
    owners: { matched: owners.matched.size, created: owners.created },
    rows: previewRows,
  };
}
