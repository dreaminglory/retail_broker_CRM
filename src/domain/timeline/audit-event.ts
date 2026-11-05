import type { AuditLogEntry } from '@/domain/audit/types';

/**
 * What an audit row means for a timeline, read from the columns and metadata its trigger
 * writes. Kept apart from the UI so each kind is tested once and both timelines agree.
 */
export type AuditEvent =
  | { kind: 'created'; importFile: string | null; imported: boolean }
  | { kind: 'stage'; from: string; to: string }
  | { kind: 'assignment'; from: string | null; to: string | null }
  | { kind: 'opportunityStatus'; from: string | null; to: string | null }
  | { kind: 'propertyCreated'; code: number | null }
  | { kind: 'propertyStatus'; from: string | null; to: string | null }
  | { kind: 'listingCreated'; offerType: string | null; price: number | null }
  | { kind: 'listingPrice'; offerType: string | null; from: number | null; to: number | null }
  | { kind: 'listingStatus'; offerType: string | null; from: string | null; to: string | null }
  | {
      kind: 'propertyLink';
      propertyId: string | null;
      code: number | null;
      /** null when the link was added */
      from: string | null;
      /** null when the link was removed */
      to: string | null;
      reason: string | null;
    }
  | { kind: 'requirement'; event: RequirementAuditEvent; changes: RequirementChange[] }
  | { kind: 'other' };

export type RequirementAuditEvent = 'created' | 'changed' | 'removed';

/** A location as the audit trigger saved it: names in both languages at the time (AD-059). */
export type RequirementAuditLocation = { settlementBg: string; settlementEn: string; area: string | null };

export type RequirementChangeValue = number | string | boolean | string[] | RequirementAuditLocation[] | null;

export type RequirementChange = { field: RequirementField; from: RequirementChangeValue; to: RequirementChangeValue };

/** The fields `audit_requirement_changes` diffs, in its order. */
export const REQUIREMENT_FIELDS = [
  'budget_min', 'budget_max', 'property_types', 'rooms_min', 'rooms_max', 'area_m2_min', 'area_m2_max',
  'floor_min', 'floor_max', 'not_top_floor', 'construction', 'financing', 'wishes',
  'budget_must', 'location_must', 'type_must', 'rooms_must', 'area_m2_must', 'floor_must', 'construction_must',
  'locations',
] as const;

export type RequirementField = (typeof REQUIREMENT_FIELDS)[number];

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isField = (value: unknown): value is RequirementField =>
  typeof value === 'string' && (REQUIREMENT_FIELDS as readonly string[]).includes(value);

function requirementValue(field: RequirementField, value: unknown): RequirementChangeValue {
  if (field === 'locations') {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) =>
      item && typeof item === 'object'
        ? [{
            settlementBg: String((item as Record<string, unknown>).settlement_bg ?? ''),
            settlementEn: String((item as Record<string, unknown>).settlement_en ?? ''),
            area: text((item as Record<string, unknown>).area),
          }]
        : [],
    );
  }
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  return null;
}

/** One save of a requirement: what changed, with the old and new value of each (Q8). */
function describeRequirement(meta: Record<string, unknown>): AuditEvent {
  const event: RequirementAuditEvent = meta.event === 'created' || meta.event === 'removed' ? meta.event : 'changed';
  const changes = (Array.isArray(meta.changes) ? meta.changes : []).flatMap((change): RequirementChange[] => {
    if (!change || typeof change !== 'object') return [];
    const { field, from, to } = change as Record<string, unknown>;
    if (!isField(field)) return [];
    return [{ field, from: requirementValue(field, from), to: requirementValue(field, to) }];
  });
  return { kind: 'requirement', event, changes };
}

export function describeAudit(row: AuditLogEntry): AuditEvent {
  const meta = row.metadata ?? {};

  if (row.field_name === 'requirement') return describeRequirement(meta);

  if (row.field_name === 'property_link') {
    return {
      kind: 'propertyLink',
      propertyId: text(meta.property_id),
      code: num(meta.property_code),
      from: row.old_value,
      to: row.new_value,
      reason: text(meta.rejected_reason),
    };
  }

  if (row.entity_type === 'listing') {
    const offerType = text(meta.offer_type);
    if (row.action === 'created') return { kind: 'listingCreated', offerType, price: num(row.new_value) };
    if (row.field_name === 'price') return { kind: 'listingPrice', offerType, from: num(row.old_value), to: num(row.new_value) };
    if (row.field_name === 'status') return { kind: 'listingStatus', offerType, from: row.old_value, to: row.new_value };
    return { kind: 'other' };
  }

  if (row.action === 'assignment_change') {
    return { kind: 'assignment', from: text(meta.old_email), to: text(meta.new_email) };
  }

  if (row.entity_type === 'property') {
    if (row.action === 'created') return { kind: 'propertyCreated', code: num(meta.code) };
    if (row.field_name === 'status') return { kind: 'propertyStatus', from: row.old_value, to: row.new_value };
    return { kind: 'other' };
  }

  switch (row.action) {
    case 'created':
      return { kind: 'created', importFile: text(meta.file_name), imported: Boolean(meta.import_job_id) };
    case 'stage_change':
      return {
        kind: 'stage',
        from: String(meta.old_stage_name || row.old_value || ''),
        to: String(meta.new_stage_name || row.new_value || ''),
      };
    case 'status_change':
      return { kind: 'opportunityStatus', from: row.old_value, to: row.new_value };
    default:
      return { kind: 'other' };
  }
}
