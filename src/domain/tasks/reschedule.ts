/**
 * Reschedule presets (Sprint 6.2, FR-TSK-08), computed in agency time:
 * +1 h, tomorrow 09:00, +2 days (same time), next Monday 09:00.
 */

import { TZDate } from '@date-fns/tz';
import { addDays, addHours, nextMonday, set } from 'date-fns';

export const RESCHEDULE_PRESETS = ['plus_1h', 'tomorrow_9', 'plus_2d', 'next_monday_9'] as const;

export type ReschedulePreset = (typeof RESCHEDULE_PRESETS)[number];

const at9 = (day: TZDate) => set(day, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

export function rescheduleDueAt(preset: ReschedulePreset, timezone: string, now: Date = new Date()): Date {
  const local = new TZDate(now, timezone);
  switch (preset) {
    case 'plus_1h':
      return new Date(addHours(local, 1).getTime());
    case 'tomorrow_9':
      return new Date(at9(addDays(local, 1)).getTime());
    case 'plus_2d':
      return new Date(addDays(local, 2).getTime());
    case 'next_monday_9':
      return new Date(at9(nextMonday(local)).getTime());
  }
}
