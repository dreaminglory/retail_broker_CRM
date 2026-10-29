/**
 * The `now` to measure a past event's relative time from. Data refreshed after
 * the clock last ticked can be newer than `now`; it then reads as "now", never
 * as "in 1 second".
 */
export function relativeTimeBase(date: Date, now: Date): Date {
  return date > now ? date : now;
}
