import { describe, expect, it } from 'vitest';
import {
  canSave,
  chooseResult,
  initialPostCallState,
  nextOptions,
  setOutcome,
  showNoNextWarning,
  toLogCallInput,
} from './post-call-state';

const INQUIRY = '11111111-1111-4111-8111-111111111111';
const opts = { noAnswerOutcome: 'No answer', closed: false, noRetry: false };
const start = initialPostCallState('phone');

describe('post-call prompt state (spec phone-loop rule 5)', () => {
  it('starts with no choice and writes nothing until one is made ("Not now")', () => {
    expect(start.result).toBeNull();
    expect(canSave(start)).toBe(false);
    expect(toLogCallInput(start, { context: { inquiry_id: INQUIRY }, name: 'Ivan', completeTaskId: null })).toBeNull();
  });

  it('No answer prefills the outcome and defaults to a retry in 1 h', () => {
    const state = chooseResult(start, 'no_answer', opts);
    expect(state).toMatchObject({ result: 'no_answer', outcome: 'No answer', next: 'plus_1h' });
    expect(canSave(state)).toBe(true);
  });

  it('Answered needs an outcome and defaults to tomorrow 09:00', () => {
    const state = chooseResult(start, 'answered', opts);
    expect(state).toMatchObject({ result: 'answered', outcome: '', next: 'tomorrow_9' });
    expect(canSave(state)).toBe(false);
    expect(canSave({ ...state, outcome: '   ' })).toBe(false);
    expect(canSave({ ...state, outcome: 'Wants a viewing' })).toBe(true);
  });

  it('keeps what the broker typed when switching to Answered', () => {
    const typed = setOutcome(chooseResult(start, 'no_answer', opts), 'Busy, call later');
    expect(chooseResult(typed, 'answered', opts).outcome).toBe('Busy, call later');
    // The untouched prefill is not carried over as an answered outcome.
    expect(chooseResult(chooseResult(start, 'no_answer', opts), 'answered', opts).outcome).toBe('');
  });

  it('offers today 18:00 only before 17:00 and no retry on a dismissed inquiry', () => {
    expect(nextOptions('no_answer', { today18: true, noRetry: false })).toEqual(['plus_1h', 'today_18', 'tomorrow_9', 'none']);
    expect(nextOptions('no_answer', { today18: false, noRetry: false })).toEqual(['plus_1h', 'tomorrow_9', 'none']);
    expect(nextOptions('no_answer', { today18: true, noRetry: true })).toEqual(['none']);
    expect(chooseResult(start, 'no_answer', { ...opts, noRetry: true }).next).toBe('none');
  });

  it('offers the answered presets, a custom time and none', () => {
    expect(nextOptions('answered', { today18: true, noRetry: false })).toEqual(['tomorrow_9', 'plus_2d', 'next_monday_9', 'custom', 'none']);
  });

  it('defaults to no next action in a closed context (rule 8)', () => {
    expect(chooseResult(start, 'answered', { ...opts, closed: true }).next).toBe('none');
  });

  it('needs a time for a custom next action', () => {
    const state = { ...chooseResult(start, 'answered', opts), outcome: 'Ok', next: 'custom' as const };
    expect(canSave(state)).toBe(false);
    expect(canSave({ ...state, customDueAt: '2026-11-20T10:00' })).toBe(true);
  });

  it('builds the logCall input', () => {
    const state = { ...chooseResult(start, 'no_answer', opts), channel: 'viber' as const };
    expect(toLogCallInput(state, { context: { inquiry_id: INQUIRY }, name: 'Ivan', completeTaskId: 'task-1' })).toEqual({
      context: { inquiry_id: INQUIRY },
      name: 'Ivan',
      channel: 'viber',
      result: 'no_answer',
      outcome: 'No answer',
      complete_task_id: 'task-1',
      next: { preset: 'plus_1h' },
    });

    const custom = { ...chooseResult(start, 'answered', opts), outcome: 'Ok', next: 'custom' as const, customDueAt: '2026-11-20T10:00' };
    expect(toLogCallInput(custom, { context: {}, name: 'Ivan', completeTaskId: null })?.next).toEqual({ due_at: '2026-11-20T10:00' });

    const none = { ...chooseResult(start, 'answered', opts), outcome: 'Ok', next: 'none' as const };
    expect(toLogCallInput(none, { context: {}, name: 'Ivan', completeTaskId: null })?.next).toBeNull();
  });

  it('warns when an answered call leaves an active deal with no next action (rule 7)', () => {
    const answeredNone = { ...chooseResult(start, 'answered', opts), next: 'none' as const };
    expect(showNoNextWarning(answeredNone, { active: true, hasOtherPendingTask: false })).toBe(true);
    expect(showNoNextWarning(answeredNone, { active: true, hasOtherPendingTask: true })).toBe(false);
    expect(showNoNextWarning(answeredNone, { active: false, hasOtherPendingTask: false })).toBe(false);
    expect(showNoNextWarning(answeredNone, undefined)).toBe(false);
    expect(showNoNextWarning({ ...answeredNone, next: 'tomorrow_9' }, { active: true, hasOtherPendingTask: false })).toBe(false);
  });
});
