import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import type { TimelineEntry } from './types';
import { TimelineService } from './service';

function failingOn(table: string) {
  const { client } = createFakeSupabase({ role: 'broker', failingTables: [table] });
  return new TimelineService(client as SupabaseClient);
}

describe('TimelineService errors', () => {
  it.each(['opportunities', 'opportunity_participants', 'notes', 'tasks', 'audit_log', 'inquiries'])(
    'a failed %s read on a contact is a translated error, not the database message',
    async (table) => {
      const error = await failingOn(table).getContactTimeline('contact-1', 'agency-1').catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );

  it.each(['opportunities', 'notes', 'tasks', 'audit_log', 'inquiries'])(
    'a failed %s read on an opportunity is a translated error',
    async (table) => {
      const error = await failingOn(table).getOpportunityTimeline('opp-1', 'agency-1').catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );
});

describe('TimelineService property feed errors', () => {
  it.each(['notes', 'tasks', 'audit_log'])('a failed %s read on a property is a translated error', async (table) => {
    const error = await failingOn(table).getPropertyTimeline('property-1', 'agency-1').catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.loadFailed');
  });
});

describe('TimelineService deal timeline: inquiries (AD-061)', () => {
  const inquiry = (id: string, receivedAt: string, updatedAt: string) => ({
    id,
    agency_id: 'agency-1',
    status: 'converted',
    received_at: receivedAt,
    updated_at: updatedAt,
    subject: id,
  });

  function timelineOf(tables: Record<string, unknown>) {
    const { client } = createFakeSupabase({ role: 'broker', tables });
    return new TimelineService(client as SupabaseClient);
  }

  const inquiryEntries = (entries: TimelineEntry[]) =>
    entries.flatMap((e) => (e.type === 'inquiry' ? [e] : []));

  it('shows the inquiry the deal started from, without the joined flag', async () => {
    const service = timelineOf({
      opportunities: { inquiry_id: 'origin' },
      inquiries: [inquiry('origin', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z')],
    });

    const [entry] = inquiryEntries(await service.getOpportunityTimeline('opp-1', 'agency-1'));

    expect(entry.data.joined).toBe(false);
    expect(entry.data.joined_at).toBeNull();
    expect(entry.timestamp).toBe('2026-11-01T09:00:00Z');
  });

  it('marks a joined inquiry and dates it by when it joined', async () => {
    const service = timelineOf({
      opportunities: { inquiry_id: 'origin' },
      inquiries: [
        inquiry('origin', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z'),
        inquiry('joiner', '2026-11-02T09:00:00Z', '2026-11-05T12:00:00Z'),
      ],
    });

    const entries = inquiryEntries(await service.getOpportunityTimeline('opp-1', 'agency-1'));

    expect(entries.map((e) => [e.data.id, e.data.joined])).toEqual([
      ['joiner', true],
      ['origin', false],
    ]);
    expect(entries[0].data.joined_at).toBe('2026-11-05T12:00:00Z');
    expect(entries[0].timestamp).toBe('2026-11-05T12:00:00Z');
  });

  it('treats every inquiry as joined when the deal has no origin inquiry', async () => {
    const service = timelineOf({
      opportunities: { inquiry_id: null },
      inquiries: [inquiry('joiner', '2026-11-02T09:00:00Z', '2026-11-05T12:00:00Z')],
    });

    const [entry] = inquiryEntries(await service.getOpportunityTimeline('opp-1', 'agency-1'));

    expect(entry.data.joined).toBe(true);
  });

  it('pages across sources by each entry\'s own date', async () => {
    const service = timelineOf({
      opportunities: { inquiry_id: 'origin' },
      inquiries: [
        inquiry('origin', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z'),
        inquiry('joiner', '2026-11-02T09:00:00Z', '2026-11-05T12:00:00Z'),
      ],
      notes: [{ id: 'n1', created_at: '2026-11-03T09:00:00Z', created_by: null, content: 'note' }],
    });

    const first = await service.getOpportunityTimeline('opp-1', 'agency-1', 2, 0);
    const second = await service.getOpportunityTimeline('opp-1', 'agency-1', 2, 2);

    expect(first.map((e) => e.type)).toEqual(['inquiry', 'note']);
    expect(second.map((e) => e.type)).toEqual(['inquiry']);
  });

  it('leaves the contact timeline without the joined fields', async () => {
    const service = timelineOf({
      inquiries: [inquiry('origin', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z')],
    });

    const [entry] = inquiryEntries(await service.getContactTimeline('contact-1', 'agency-1'));

    expect(entry.data.joined).toBeUndefined();
    expect(entry.timestamp).toBe('2026-11-01T09:00:00Z');
  });
});
