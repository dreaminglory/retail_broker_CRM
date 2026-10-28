import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDayBounds, getStaleThreshold, getUpcomingRange } from './agency-day';

const SOFIA = 'Europe/Sofia';
const utc = (iso: string) => new Date(iso).toISOString();

describe('getDayBounds', () => {
  it('uses the agency day, not the UTC day (winter, UTC+2)', () => {
    const bounds = getDayBounds(SOFIA, new Date('2026-01-10T12:00:00Z'));
    expect(utc(bounds.start)).toBe('2026-01-09T22:00:00.000Z');
    expect(utc(bounds.end)).toBe('2026-01-10T21:59:59.999Z');
  });

  it('treats 23:30 UTC as the next day in Sofia (summer, UTC+3)', () => {
    const bounds = getDayBounds(SOFIA, new Date('2026-07-15T21:30:00Z'));
    expect(utc(bounds.start)).toBe('2026-07-15T21:00:00.000Z');
    expect(utc(bounds.end)).toBe('2026-07-16T20:59:59.999Z');
  });

  it('handles the 25-hour day when DST ends', () => {
    const bounds = getDayBounds(SOFIA, new Date('2026-10-25T12:00:00Z'));
    expect(utc(bounds.start)).toBe('2026-10-24T21:00:00.000Z');
    expect(utc(bounds.end)).toBe('2026-10-25T21:59:59.999Z');
  });
});

describe('relative ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('upcoming runs from tomorrow 00:00 to the end of day +3, agency time', () => {
    const range = getUpcomingRange(SOFIA);
    expect(utc(range.start)).toBe('2026-01-10T22:00:00.000Z');
    expect(utc(range.end)).toBe('2026-01-13T21:59:59.999Z');
  });

  it('stale threshold is the start of the day 7 days ago, agency time', () => {
    expect(utc(getStaleThreshold(SOFIA))).toBe('2026-01-02T22:00:00.000Z');
  });
});
