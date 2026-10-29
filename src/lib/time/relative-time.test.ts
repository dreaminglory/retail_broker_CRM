import { describe, expect, it } from 'vitest';
import { relativeTimeBase } from './relative-time';

describe('relativeTimeBase', () => {
  const now = new Date('2026-01-15T12:00:00Z');

  it('measures a past event from now', () => {
    expect(relativeTimeBase(new Date('2026-01-15T11:00:00Z'), now)).toEqual(now);
  });

  it('never makes a past event read as in the future when the data is newer than now', () => {
    const justNow = new Date('2026-01-15T12:00:01Z');
    expect(relativeTimeBase(justNow, now)).toEqual(justNow);
  });
});
