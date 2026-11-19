/**
 * Reschedule presets (Sprint 6.2, FR-TSK-08), computed in agency time:
 * +1 h, tomorrow 09:00, +2 days (same time), next Monday 09:00.
 * `today_18` is offered by the post-call prompt only (spec phone-loop rule 5), so it is not in
 * `RESCHEDULE_PRESETS`, which Today's reschedule menu lists.
 */

import { TZDate } from '@date-fns/tz';
import { addDays, addHours, nextMonday, set } from 'date-fns';

export const RESCHEDULE_PRESETS = ['plus_1h', 'tomorrow_9', 'plus_2d', 'next_monday_9'] as const;

export type ReschedulePreset = (typeof RESCHEDULE_PRESETS)[number];

/** Every preset a due date can be computed from, the prompt's `today_18` included. */
export type DuePreset = ReschedulePreset | 'today_18';

/** `today_18` is offered before this hour, agency time. */
const TODAY_18_CUTOFF_HOUR = 17;

const at = (day: TZDate, hours: number) => set(day, { hours, minutes: 0, seconds: 0, milliseconds: 0 });

export function rescheduleDueAt(preset: DuePreset, timezone: string, now: Date = new Date()): Date {
  const local = new TZDate(now, timezone);
  switch (preset) {
    case 'plus_1h':
      return new Date(addHours(local, 1).getTime());
    case 'today_18':
      return new Date(at(local, 18).getTime());
    case 'tomorrow_9':
      return new Date(at(addDays(local, 1), 9).getTime());
    case 'plus_2d':
      return new Date(addDays(local, 2).getTime());
    case 'next_monday_9':
      return new Date(at(nextMonday(local), 9).getTime());
  }
}

/** "Today 18:00" makes sense as a retry only before 17:00 agency time. */
export function isToday18Available(timezone: string, now: Date = new Date()): boolean {
  return new TZDate(now, timezone).getHours() < TODAY_18_CUTOFF_HOUR;
}
