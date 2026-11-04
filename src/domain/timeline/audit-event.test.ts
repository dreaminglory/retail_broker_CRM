import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '@/domain/audit/types';
import { describeAudit } from './audit-event';

function row(values: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: 'audit-1',
    agency_id: 'agency-1',
    entity_type: 'opportunity',
    entity_id: 'entity-1',
    action: 'field_change',
    field_name: null,
    old_value: null,
    new_value: null,
    metadata: null,
    performed_by: null,
    performed_at: '2026-11-04T10:00:00Z',
    ...values,
  };
}

describe('describeAudit', () => {
  it('reads a listing price change as both prices in numbers (AC-5)', () => {
    const event = describeAudit(
      row({
        entity_type: 'listing',
        action: 'field_change',
        field_name: 'price',
        old_value: '185000.00',
        new_value: '179000.00',
        metadata: { property_id: 'p-1', offer_type: 'sale' },
      })
    );

    expect(event).toEqual({ kind: 'listingPrice', offerType: 'sale', from: 185000, to: 179000 });
  });

  it('reads a new listing with its offer type and price', () => {
    const event = describeAudit(
      row({ entity_type: 'listing', action: 'created', new_value: '300.00', metadata: { offer_type: 'rent' } })
    );

    expect(event).toEqual({ kind: 'listingCreated', offerType: 'rent', price: 300 });
  });

  it('reads a listing status change', () => {
    const event = describeAudit(
      row({ entity_type: 'listing', action: 'status_change', field_name: 'status', old_value: 'active', new_value: 'reserved', metadata: { offer_type: 'sale' } })
    );

    expect(event).toEqual({ kind: 'listingStatus', offerType: 'sale', from: 'active', to: 'reserved' });
  });

  it('reads a property link change with the property code, on either timeline', () => {
    const event = describeAudit(
      row({
        action: 'status_change',
        field_name: 'property_link',
        old_value: 'candidate',
        new_value: 'rejected',
        metadata: { property_id: 'p-1', property_code: 1042, relation: 'candidate', rejected_reason: 'Too dark' },
      })
    );

    expect(event).toEqual({
      kind: 'propertyLink',
      propertyId: 'p-1',
      code: 1042,
      from: 'candidate',
      to: 'rejected',
      reason: 'Too dark',
    });
  });

  it('reads adding and removing a link as a missing side', () => {
    const added = describeAudit(row({ action: 'status_change', field_name: 'property_link', new_value: 'subject', metadata: { property_id: 'p-1', property_code: 7 } }));
    const removed = describeAudit(row({ action: 'status_change', field_name: 'property_link', old_value: 'viewed', metadata: { property_id: 'p-1', property_code: 7 } }));

    expect(added).toMatchObject({ kind: 'propertyLink', from: null, to: 'subject' });
    expect(removed).toMatchObject({ kind: 'propertyLink', from: 'viewed', to: null });
  });

  it('reads property creation, status and archiving', () => {
    expect(describeAudit(row({ entity_type: 'property', action: 'created', metadata: { code: 1042 } }))).toEqual({ kind: 'propertyCreated', code: 1042 });
    expect(describeAudit(row({ entity_type: 'property', action: 'archived', field_name: 'status', old_value: 'active', new_value: 'archived' }))).toEqual({
      kind: 'propertyStatus',
      from: 'active',
      to: 'archived',
    });
  });

  it('reads an assignment change from the e-mails the trigger stores', () => {
    const event = describeAudit(
      row({ action: 'assignment_change', field_name: 'assigned_to', metadata: { old_email: 'a@alpha.bg', new_email: 'b@alpha.bg' } })
    );

    expect(event).toEqual({ kind: 'assignment', from: 'a@alpha.bg', to: 'b@alpha.bg' });
  });

  it('keeps the opportunity events as they were', () => {
    expect(describeAudit(row({ action: 'stage_change', old_value: 'x', new_value: 'y', metadata: { old_stage_name: 'New', new_stage_name: 'Viewing' } }))).toEqual({
      kind: 'stage',
      from: 'New',
      to: 'Viewing',
    });
    expect(describeAudit(row({ action: 'status_change', field_name: 'status', old_value: 'active', new_value: 'won' }))).toEqual({
      kind: 'opportunityStatus',
      from: 'active',
      to: 'won',
    });
    expect(describeAudit(row({ action: 'created', metadata: { import_job_id: 'job-1', file_name: 'leads.csv' } }))).toEqual({
      kind: 'created',
      importFile: 'leads.csv',
      imported: true,
    });
    expect(describeAudit(row({ action: 'merged' }))).toEqual({ kind: 'other' });
  });
});
