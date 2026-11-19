import { describe, expect, it } from 'vitest';
import {
  canSave,
  chooseResult,
  initialPostCallState,
  nextOptions,
  setOutcome,
  showNoNextWarning,
  toLogCallInput,
  callDeal,
  callContext,
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
    const deal = (active: boolean, pendingTaskCount: number) => ({ id: 'd1', title: 'Deal', stageId: 's1', active, pendingTaskCount });
    expect(showNoNextWarning(answeredNone, deal(true, 0), false)).toBe(true);
    expect(showNoNextWarning(answeredNone, deal(true, 1), false)).toBe(false);
    // Completing the deal's only pending task leaves nothing next.
    expect(showNoNextWarning(answeredNone, deal(true, 1), true)).toBe(true);
    expect(showNoNextWarning(answeredNone, deal(true, 2), true)).toBe(false);
    expect(showNoNextWarning(answeredNone, deal(false, 0), false)).toBe(false);
    expect(showNoNextWarning(answeredNone, undefined, false)).toBe(false);
    expect(showNoNextWarning({ ...answeredNone, next: 'tomorrow_9' }, deal(true, 0), false)).toBe(false);
  });
});

describe('post-call deal context (spec phone-loop rule 2)', () => {
  const CONTACT = '22222222-2222-4222-8222-222222222222';
  const a = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Flat', stageId: 's1', active: true, pendingTaskCount: 0 };
  const b = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'House', stageId: 's2', active: true, pendingTaskCount: 1 };

  it("uses the target's own deal when there is no picker", () => {
    const target = { context: { contact_id: CONTACT, opportunity_id: a.id }, name: 'Ivan', deal: a };
    expect(callDeal(target, null)).toBe(a);
    expect(callContext(target, null)).toEqual({ contact_id: CONTACT, opportunity_id: a.id });
  });

  it('logs against the picked deal, or the contact alone with "no deal"', () => {
    const target = { context: { contact_id: CONTACT }, name: 'Ivan', dealChoices: [a, b] };
    expect(callDeal(target, b.id)).toBe(b);
    expect(callContext(target, b.id)).toEqual({ contact_id: CONTACT, opportunity_id: b.id });
    expect(callDeal(target, null)).toBeUndefined();
    expect(callContext(target, null)).toEqual({ contact_id: CONTACT });
    // An id that is not one of the choices is ignored.
    expect(callContext(target, 'x')).toEqual({ contact_id: CONTACT });
  });

  it("sends a stage change only when it differs from the deal's stage", () => {
    const answered = { ...chooseResult(start, 'answered', opts), outcome: 'Ok' };
    const base = { context: { opportunity_id: a.id }, name: 'Ivan', completeTaskId: null, currentStageId: 's1' };
    expect(toLogCallInput({ ...answered, stageId: 's3' }, base)?.new_stage_id).toBe('s3');
    expect(toLogCallInput({ ...answered, stageId: 's1' }, base)?.new_stage_id).toBeUndefined();
    expect(toLogCallInput(answered, base)?.new_stage_id).toBeUndefined();
    // No stage change after no answer.
    expect(toLogCallInput({ ...chooseResult(start, 'no_answer', opts), stageId: 's3' }, base)?.new_stage_id).toBeUndefined();
  });
});
