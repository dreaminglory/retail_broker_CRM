import { TZDate } from '@date-fns/tz';
import { startOfDay, addDays, subDays, format } from 'date-fns';

export const DEFAULT_AGENCY_TIMEZONE = 'Europe/Sofia';

/**
 * Returns the exact time `days` ago at the start of the day in the given timezone.
 * Used for stale queries.
 */
export function getStaleThreshold(timezone: string, days: number = 7) {
  const tzDate = new TZDate(new Date(), timezone);
  const targetDay = subDays(tzDate, days);
  return startOfDay(targetDay).toISOString();
}

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const WITH_OFFSET = /T.*(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parses a wall-clock value from a `datetime-local` input (`YYYY-MM-DDTHH:mm`)
 * as agency time, so the server's own timezone never shifts a due date.
 * A value that already names its offset (an ISO instant) is kept as is.
 * Returns null for anything else.
 */
export function parseAgencyLocal(value: string, timezone: string): Date | null {
  if (WITH_OFFSET.test(value)) {
    const instant = new Date(value);
    return isNaN(instant.getTime()) ? null : instant;
  }
  const m = LOCAL_DATE_TIME.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, timezone).getTime());
}

export type TodayBucket = 'overdue' | 'dueToday' | 'upcoming' | 'later';

export type TodayWindows = {
  overdueBefore: string;
  dueToday: { from: string; before: string };
  upcoming: { from: string; before: string };
};

/**
 * The Today sections as half-open UTC ranges, so each pending task falls in
 * exactly one: overdue before now, due today from now to agency midnight,
 * upcoming from tomorrow through day +`upcomingDays`.
 */
export function getTodayWindows(timezone: string, now: Date = new Date(), upcomingDays = 3): TodayWindows {
  const today = startOfDay(new TZDate(now, timezone));
  const utc = (d: Date) => new Date(d.getTime()).toISOString();
  const tomorrow = utc(addDays(today, 1));
  return {
    overdueBefore: utc(now),
    dueToday: { from: utc(now), before: tomorrow },
    upcoming: { from: tomorrow, before: utc(addDays(today, upcomingDays + 1)) },
  };
}

/** Which Today section a pending task due at `dueAt` belongs to. */
export function todayBucket(dueAt: string, timezone: string, now: Date = new Date()): TodayBucket {
  const w = getTodayWindows(timezone, now);
  const due = new Date(dueAt).getTime();
  if (due < new Date(w.overdueBefore).getTime()) return 'overdue';
  if (due < new Date(w.dueToday.before).getTime()) return 'dueToday';
  if (due < new Date(w.upcoming.before).getTime()) return 'upcoming';
  return 'later';
}

/** The inverse of `parseAgencyLocal`: an instant as a `datetime-local` value in agency time. */
export function toAgencyLocalInput(iso: string, timezone: string): string {
  return format(new TZDate(new Date(iso), timezone), "yyyy-MM-dd'T'HH:mm");
}
