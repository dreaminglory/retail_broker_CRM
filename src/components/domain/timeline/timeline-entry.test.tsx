import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import type { TimelineEntry } from '@/domain/timeline/types';
import { TimelineEntryItem } from './timeline-entry';

/**
 * Hydration: the server renders at its `now`, the browser hydrates a moment later with the
 * same props and the same provider `now`. Both must produce the same text.
 */
const SERVER_NOW = new Date('2026-11-04T10:00:08Z');

const entry: TimelineEntry = {
  type: 'task',
  timestamp: '2026-11-04T10:00:00Z',
  isCompletionEvent: false,
  data: { title: 'Call back', created_at: '2026-11-04T10:00:00Z', status: 'pending' } as never,
};

function renderAt(clock: Date) {
  vi.setSystemTime(clock);
  return renderToString(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Sofia" now={SERVER_NOW}>
      <TimelineEntryItem entry={entry} />
    </NextIntlClientProvider>
  );
}

describe('TimelineEntryItem property link rows', () => {
  const link: TimelineEntry = {
    type: 'audit',
    timestamp: '2026-11-04T09:00:00Z',
    data: {
      id: 'a1',
      agency_id: 'agency-1',
      entity_type: 'opportunity',
      entity_id: 'opp-1',
      action: 'status_change',
      field_name: 'property_link',
      old_value: 'candidate',
      new_value: 'offered',
      metadata: { property_id: 'p-1', property_code: 1001 },
      performed_by: null,
      performed_at: '2026-11-04T09:00:00Z',
      opportunity: { id: 'opp-1', title: 'Ivan buys' },
    },
  };

  const render = (showDeal?: boolean) =>
    renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Sofia" now={SERVER_NOW}>
        <TimelineEntryItem entry={link} showDeal={showDeal} />
      </NextIntlClientProvider>
    );

  it('names the property once on the deal timeline, as a link', () => {
    const html = render();

    expect(html.match(/#1001/g)).toHaveLength(1);
    expect(html).toContain('href="/properties/p-1"');
  });

  it('names the deal, not its own code, on the property timeline', () => {
    const html = render(true);

    expect(html).not.toContain('#1001');
    expect(html).toContain('Ivan buys');
  });
});

describe('TimelineEntryItem relative time', () => {
  afterEach(() => vi.useRealTimers());

  it('renders the same on the server and at hydration a second later', () => {
    vi.useFakeTimers();
    const server = renderAt(SERVER_NOW);
    const client = renderAt(new Date(SERVER_NOW.getTime() + 1000));

    expect(server).toContain('8 seconds ago');
    expect(client).toBe(server);
  });
});

describe('TimelineEntryItem requirement rows (AD-059)', () => {
  const lozenets = { settlement_id: 's-1', settlement_bg: 'София', settlement_en: 'Sofia', area_id: 'a-1', area: 'Лозенец' };
  const mladost = { settlement_id: 's-1', settlement_bg: 'София', settlement_en: 'Sofia', area_id: 'a-2', area: 'Младост 1' };
  const varna = { settlement_id: 's-2', settlement_bg: 'Варна', settlement_en: 'Varna', area_id: null, area: null };

  const audit = (metadata: Record<string, unknown>): TimelineEntry => ({
    type: 'audit',
    timestamp: '2026-11-04T09:00:00Z',
    data: {
      id: 'a1',
      agency_id: 'agency-1',
      entity_type: 'opportunity',
      entity_id: 'opp-1',
      action: 'field_change',
      field_name: 'requirement',
      old_value: null,
      new_value: null,
      metadata,
      performed_by: null,
      performed_at: '2026-11-04T09:00:00Z',
    },
  });

  const render = (locale: 'bg' | 'en', entry: TimelineEntry) =>
    renderToString(
      <NextIntlClientProvider locale={locale} messages={locale === 'bg' ? bg : en} timeZone="Europe/Sofia" now={SERVER_NOW}>
        <TimelineEntryItem entry={entry} />
      </NextIntlClientProvider>
    )
      .replace(/<!-- -->/g, '')
      .replace(/[\u00a0\u202f]/g, ' ');

  const ac2 = audit({
    event: 'changed',
    changes: [
      { field: 'budget_max', from: 200000, to: 220000 },
      { field: 'locations', from: [lozenets], to: [lozenets, mladost] },
    ],
  });

  it('shows AC-2 as one entry with the old and new budget and locations (BG)', () => {
    const html = render('bg', ac2);

    expect(html).toContain('Изискванията са променени');
    expect(html).toContain('Бюджет до');
    expect(html).toContain('200 000 €');
    expect(html).toContain('220 000 €');
    expect(html).toContain('Местоположение');
    expect(html).toContain('Младост 1');
  });

  it('shows AC-2 in English', () => {
    const html = render('en', ac2);

    expect(html).toContain('Requirements changed');
    expect(html).toContain('Budget up to');
    expect(html).toContain('€200,000');
    expect(html).toContain('€220,000');
    expect(html).toContain('Locations');
  });

  it.each([
    ['bg', 'Варна', 'Апартамент', 'Задължителни', 'бюджет'],
    ['en', 'Varna', 'Apartment', 'Must-haves', 'budget'],
  ] as const)('shows a created entry with the settlement in the locale and the must-haves together (%s)', (locale, settlement, type, must, budget) => {
    const html = render(
      locale,
      audit({
        event: 'created',
        changes: [
          { field: 'budget_max', from: null, to: 800 },
          { field: 'property_types', from: [], to: ['apartment'] },
          { field: 'budget_must', from: false, to: true },
          { field: 'locations', from: [], to: [varna] },
        ],
      })
    );

    expect(html).toContain(settlement);
    expect(html).toContain(type);
    expect(html).toContain(must);
    expect(html).toContain(budget);
  });

  it.each([
    ['bg', 'Изискванията са премахнати', 'Стаи от'],
    ['en', 'Requirements removed', 'Rooms from'],
  ] as const)('shows a removed entry with what it had (%s)', (locale, title, label) => {
    const html = render(locale, audit({ event: 'removed', changes: [{ field: 'rooms_min', from: 2, to: null }] }));

    expect(html).toContain(title);
    expect(html).toContain(label);
  });

  it('writes the type list as the summary does', () => {
    const html = render('bg', audit({ event: 'created', changes: [{ field: 'property_types', from: [], to: ['apartment', 'maisonette'] }] }));

    expect(html).toContain('Апартамент или мезонет');
  });

  it('keeps the area name the entry was saved with', () => {
    const renamed = { ...lozenets, area: 'Лозенец (стар)' };

    expect(render('en', audit({ event: 'created', changes: [{ field: 'locations', from: [], to: [renamed] }] }))).toContain('Лозенец (стар)');
  });

  it('names a changed must-have and its two states', () => {
    const html = render('en', audit({ event: 'changed', changes: [{ field: 'rooms_must', from: false, to: true }] }));

    expect(html).toContain('Rooms: must-have');
    expect(html).toContain('No');
    expect(html).toContain('Yes');
  });
});
