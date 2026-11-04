import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
