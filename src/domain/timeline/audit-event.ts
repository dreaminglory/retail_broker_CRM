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
  | { kind: 'other' };

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function describeAudit(row: AuditLogEntry): AuditEvent {
  const meta = row.metadata ?? {};

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
