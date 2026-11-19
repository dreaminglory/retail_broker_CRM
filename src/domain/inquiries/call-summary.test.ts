import { describe, expect, it } from 'vitest';
import { contactDelay, inquiryCallSummary } from './call-summary';

describe('contactDelay (spec phone-loop rule 9: "Contacted after 2 h 10 min")', () => {
  it('gives minutes under an hour', () => {
    expect(contactDelay('2026-11-19T10:00:00Z', '2026-11-19T10:07:40Z')).toEqual({ unit: 'minutes', days: 0, hours: 0, minutes: 7 });
  });

  it('gives hours and minutes under a day', () => {
    expect(contactDelay('2026-11-19T10:00:00Z', '2026-11-19T12:10:00Z')).toEqual({ unit: 'hours', days: 0, hours: 2, minutes: 10 });
  });

  it('gives days and hours from a day on', () => {
    expect(contactDelay('2026-11-17T10:00:00Z', '2026-11-19T13:30:00Z')).toEqual({ unit: 'days', days: 2, hours: 3, minutes: 30 });
  });

  it('is zero when contacted before it was received (an imported inquiry)', () => {
    expect(contactDelay('2026-11-19T10:00:00Z', '2026-11-19T09:00:00Z')).toEqual({ unit: 'minutes', days: 0, hours: 0, minutes: 0 });
  });
});

describe('inquiryCallSummary (rule 9: last call and pending retry)', () => {
  const call = (over: Record<string, unknown>) => ({
    status: 'completed',
    task_type: 'call',
    outcome: 'No answer',
    completed_at: '2026-11-19T12:05:00Z',
    due_at: null,
    channel: 'phone',
    ...over,
  });

  it('takes the latest completed call or email and the earliest pending call', () => {
    const summary = inquiryCallSummary([
      call({ outcome: 'Old', completed_at: '2026-11-19T09:00:00Z' }),
      call({ outcome: 'Busy', completed_at: '2026-11-19T12:05:00Z', channel: 'viber' }),
      call({ status: 'pending', completed_at: null, outcome: null, due_at: '2026-11-19T15:00:00Z' }),
      call({ status: 'pending', completed_at: null, outcome: null, due_at: '2026-11-19T14:00:00Z' }),
    ]);
    expect(summary).toEqual({
      lastCall: { outcome: 'Busy', at: '2026-11-19T12:05:00Z', channel: 'viber' },
      nextRetryAt: '2026-11-19T14:00:00Z',
    });
  });

  it('ignores cancelled tasks and other task types', () => {
    expect(
      inquiryCallSummary([
        call({ status: 'cancelled', completed_at: null }),
        call({ task_type: 'viewing' }),
        call({ task_type: 'follow_up', status: 'pending', completed_at: null, due_at: '2026-11-19T14:00:00Z' }),
      ]),
    ).toEqual({ lastCall: null, nextRetryAt: null });
  });

  it('is empty without tasks', () => {
    expect(inquiryCallSummary(undefined)).toEqual({ lastCall: null, nextRetryAt: null });
  });
});
