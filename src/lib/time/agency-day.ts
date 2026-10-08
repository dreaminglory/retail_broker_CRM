import { TZDate } from '@date-fns/tz';
import { startOfDay, endOfDay, addDays, subDays } from 'date-fns';

/**
 * Returns the start and end of a specific date in the given timezone,
 * returned as UTC ISO strings suitable for database queries.
 * @param timezone The agency's timezone (e.g., 'Europe/Sofia')
 * @param date The date to get bounds for (defaults to now)
 */
export function getDayBounds(timezone: string, date: Date = new Date()) {
  const tzDate = new TZDate(date, timezone);
  const start = startOfDay(tzDate);
  const end = endOfDay(tzDate);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

/**
 * Returns the start of tomorrow and the end of the day N days from today
 * in the given timezone. Used for "Coming up" queries.
 */
export function getUpcomingRange(timezone: string, days: number = 3) {
  const tzDate = new TZDate(new Date(), timezone);
  const tomorrow = addDays(tzDate, 1);
  const targetDay = addDays(tzDate, days);
  return {
    start: startOfDay(tomorrow).toISOString(),
    end: endOfDay(targetDay).toISOString()
  };
}

/**
 * Returns the exact time `days` ago at the start of the day in the given timezone.
 * Used for stale queries.
 */
export function getStaleThreshold(timezone: string, days: number = 7) {
  const tzDate = new TZDate(new Date(), timezone);
  const targetDay = subDays(tzDate, days);
  return startOfDay(targetDay).toISOString();
}
