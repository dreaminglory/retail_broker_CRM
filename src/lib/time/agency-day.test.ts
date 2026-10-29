import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStaleThreshold, getTodayWindows, parseAgencyLocal, toAgencyLocalInput, todayBucket } from './agency-day';

const SOFIA = 'Europe/Sofia';
const utc = (iso: string) => new Date(iso).toISOString();

describe('relative ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stale threshold is the start of the day 7 days ago, agency time', () => {
    expect(utc(getStaleThreshold(SOFIA))).toBe('2026-01-02T22:00:00.000Z');
  });
});

describe('parseAgencyLocal', () => {
  it('reads a datetime-local value as Sofia winter time (UTC+2)', () => {
    expect(parseAgencyLocal('2026-01-15T14:00', SOFIA)?.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('reads summer values as UTC+3, across the DST change', () => {
    expect(parseAgencyLocal('2026-07-15T14:00', SOFIA)?.toISOString()).toBe('2026-07-15T11:00:00.000Z');
  });

  it('keeps an instant that already carries an offset', () => {
    expect(parseAgencyLocal('2026-01-15T12:00:00.000Z', SOFIA)?.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    expect(parseAgencyLocal('2026-01-15T14:00:00+02:00', SOFIA)?.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('rejects values that are not a date and time', () => {
    expect(parseAgencyLocal('2026-01-15T25:00:00Z', SOFIA)).toBeNull();
    expect(parseAgencyLocal('2026-01-15', SOFIA)).toBeNull();
    expect(parseAgencyLocal('tomorrow', SOFIA)).toBeNull();
  });
});

describe('Today buckets', () => {
  // Thursday 15 January 2026, 13:30 in Sofia
  const now = new Date('2026-01-15T11:30:00Z');

  it.each([
    ['2026-01-15T07:00:00Z', 'overdue'], // 09:00 today, already past
    ['2026-01-14T10:00:00Z', 'overdue'],
    ['2026-01-15T12:00:00Z', 'dueToday'], // 14:00 today (AC-6.2-1)
    ['2026-01-15T21:59:00Z', 'dueToday'], // 23:59 today
    ['2026-01-15T22:00:00Z', 'upcoming'], // 00:00 tomorrow
    ['2026-01-18T21:59:00Z', 'upcoming'], // 23:59 on day +3
    ['2026-01-18T22:00:00Z', 'later'],
  ] as const)('a task due %s is in %s', (dueAt, bucket) => {
    expect(todayBucket(dueAt, SOFIA, now)).toBe(bucket);
  });

  it('a task due earlier today is overdue, not also due today', () => {
    const w = getTodayWindows(SOFIA, now);
    expect(w.overdueBefore).toBe('2026-01-15T11:30:00.000Z');
    expect(w.dueToday).toEqual({ from: '2026-01-15T11:30:00.000Z', before: '2026-01-15T22:00:00.000Z' });
    expect(w.upcoming).toEqual({ from: '2026-01-15T22:00:00.000Z', before: '2026-01-18T22:00:00.000Z' });
  });

  it('today ends at agency midnight on the 25-hour day when DST ends', () => {
    const w = getTodayWindows(SOFIA, new Date('2026-10-25T12:00:00Z'));
    expect(w.dueToday.before).toBe('2026-10-25T22:00:00.000Z');
  });

  it('a late-evening UTC time is already tomorrow in Sofia (summer)', () => {
    const w = getTodayWindows(SOFIA, new Date('2026-07-15T21:30:00Z'));
    expect(w.dueToday.before).toBe('2026-07-16T21:00:00.000Z');
  });
});

describe('toAgencyLocalInput', () => {
  it('shows a stored instant as the agency wall clock for a datetime-local input', () => {
    expect(toAgencyLocalInput('2026-01-15T12:00:00.000Z', SOFIA)).toBe('2026-01-15T14:00');
    expect(toAgencyLocalInput('2026-07-15T21:30:00.000Z', SOFIA)).toBe('2026-07-16T00:30');
  });
});
