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
