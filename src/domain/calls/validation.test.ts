import { describe, expect, it } from 'vitest';
import { logCallSchema } from './validation';

const INQUIRY = '11111111-1111-4111-8111-111111111111';
const DEAL = '22222222-2222-4222-8222-222222222222';
const schema = logCallSchema('Europe/Sofia');

const base = {
  context: { inquiry_id: INQUIRY },
  name: 'Ivan Petrov',
  channel: 'phone',
  result: 'no_answer',
  outcome: 'No answer',
  next: { preset: 'plus_1h' },
} as const;

const issues = (input: unknown) => {
  const parsed = schema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
};

describe('logCallSchema (spec phone-loop rules 5 and 6)', () => {
  it('accepts a no-answer with a retry preset', () => {
    expect(issues(base)).toEqual([]);
  });

  it('accepts every retry preset and no retry', () => {
    for (const preset of ['plus_1h', 'today_18', 'tomorrow_9']) {
      expect(issues({ ...base, next: { preset } }), preset).toEqual([]);
    }
    expect(issues({ ...base, next: null })).toEqual([]);
  });

  it('refuses a next-action preset or a custom date as a retry', () => {
    expect(issues({ ...base, next: { preset: 'next_monday_9' } })).toEqual(['next:phoneLoop.errors.invalidNext']);
    expect(issues({ ...base, next: { due_at: '2026-01-20T14:00' } })).toEqual(['next:phoneLoop.errors.invalidNext']);
  });

  it('requires an outcome when answered (K1)', () => {
    expect(issues({ ...base, result: 'answered', outcome: '  ', next: null })).toEqual(['outcome:validation.outcome_required']);
  });

  it('accepts the answered next-action presets and a custom agency-time date', () => {
    for (const preset of ['tomorrow_9', 'plus_2d', 'next_monday_9']) {
      expect(issues({ ...base, result: 'answered', outcome: 'Wants a viewing', next: { preset } }), preset).toEqual([]);
    }
    const parsed = schema.parse({ ...base, result: 'answered', outcome: 'Wants a viewing', next: { due_at: '2026-01-20T14:00' } });
    expect(parsed.next).toEqual({ due_at: '2026-01-20T12:00:00.000Z' });
  });

  it('refuses a retry preset as an answered next action', () => {
    expect(issues({ ...base, result: 'answered', outcome: 'Ok', next: { preset: 'plus_1h' } })).toEqual([
      'next:phoneLoop.errors.invalidNext',
    ]);
  });

  it('allows a stage change on an answered call only', () => {
    expect(issues({ ...base, context: { opportunity_id: DEAL }, result: 'answered', outcome: 'Ok', next: null, new_stage_id: DEAL })).toEqual([]);
    expect(issues({ ...base, context: { opportunity_id: DEAL }, new_stage_id: DEAL })).toEqual(['new_stage_id:phoneLoop.errors.stageNeedsAnswer']);
  });

  it('refuses an unknown channel', () => {
    expect(issues({ ...base, channel: 'sms' })).toHaveLength(1);
  });

  it('needs a deal, a contact or an inquiry to log against', () => {
    expect(issues({ ...base, context: {} })).toEqual(['context:phoneLoop.errors.noContext']);
  });

  it('trims the outcome and the name', () => {
    const parsed = schema.parse({ ...base, name: ' Ivan ', outcome: ' No answer ' });
    expect(parsed).toMatchObject({ name: 'Ivan', outcome: 'No answer' });
  });
});
