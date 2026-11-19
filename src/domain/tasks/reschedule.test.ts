import { describe, expect, it } from 'vitest';
import { RESCHEDULE_PRESETS, isToday18Available, rescheduleDueAt } from './reschedule';

const SOFIA = 'Europe/Sofia';

describe('today_18 preset (spec phone-loop rule 5)', () => {
  it('is 18:00 agency time today', () => {
    // 10:00 in Sofia (UTC+2 in January).
    const now = new Date('2026-01-15T08:00:00Z');
    expect(rescheduleDueAt('today_18', SOFIA, now).toISOString()).toBe('2026-01-15T16:00:00.000Z');
  });

  it('is offered before 17:00 agency time only', () => {
    expect(isToday18Available(SOFIA, new Date('2026-01-15T14:59:00Z'))).toBe(true); // 16:59
    expect(isToday18Available(SOFIA, new Date('2026-01-15T15:00:00Z'))).toBe(false); // 17:00
    expect(isToday18Available(SOFIA, new Date('2026-01-15T21:00:00Z'))).toBe(false); // 23:00
  });

  it('reads the cutoff in agency time, not UTC', () => {
    // 16:30 UTC is 18:30 in Sofia but 08:30 in Los Angeles.
    const now = new Date('2026-01-15T16:30:00Z');
    expect(isToday18Available(SOFIA, now)).toBe(false);
    expect(isToday18Available('America/Los_Angeles', now)).toBe(true);
  });

  it("stays out of Today's reschedule menu", () => {
    expect(RESCHEDULE_PRESETS).not.toContain('today_18');
  });
});
