/**
 * The post-call prompt's state, kept pure so its rules are unit-tested (spec phone-loop rule 5).
 * Nothing is written until the broker picks Answered or No answer and saves; "Not now" just
 * closes, so a state with no result has no input to send.
 */

import type { DuePreset } from '@/domain/tasks/reschedule';
import type { CallChannel, CallContext, CallResult, LogCallInput } from '@/domain/calls/types';

export type NextChoice = DuePreset | 'custom' | 'none';

export type PostCallState = {
  result: CallResult | null;
  outcome: string;
  /** True while the outcome is still the "No answer" prefill. */
  outcomePrefilled: boolean;
  next: NextChoice;
  /** A `datetime-local` value, read in agency time by the server. */
  customDueAt: string;
  channel: CallChannel;
};

export type ResultOptions = {
  /** "No answer" / "Не вдига", in the broker's language. */
  noAnswerOutcome: string;
  /** A won, lost or archived deal: no next action by default (rule 8). */
  closed: boolean;
  /** A dismissed inquiry: no retry (rule 8). */
  noRetry: boolean;
};

export function initialPostCallState(channel: CallChannel): PostCallState {
  return { result: null, outcome: '', outcomePrefilled: false, next: 'none', customDueAt: '', channel };
}

export function chooseResult(state: PostCallState, result: CallResult, opts: ResultOptions): PostCallState {
  const typed = state.outcomePrefilled ? '' : state.outcome;
  if (result === 'answered') {
    return { ...state, result, outcome: typed, outcomePrefilled: false, next: opts.closed ? 'none' : 'tomorrow_9' };
  }
  return {
    ...state,
    result,
    outcome: typed || opts.noAnswerOutcome,
    outcomePrefilled: !typed,
    next: opts.noRetry ? 'none' : 'plus_1h',
  };
}

/** The broker typing an outcome; it is theirs from then on, not the prefill. */
export function setOutcome(state: PostCallState, outcome: string): PostCallState {
  return { ...state, outcome, outcomePrefilled: false };
}

export function nextOptions(result: CallResult, opts: { today18: boolean; noRetry: boolean }): NextChoice[] {
  if (result === 'answered') return ['tomorrow_9', 'plus_2d', 'next_monday_9', 'custom', 'none'];
  if (opts.noRetry) return ['none'];
  return ['plus_1h', ...(opts.today18 ? (['today_18'] as const) : []), 'tomorrow_9', 'none'];
}

export function canSave(state: PostCallState): boolean {
  if (!state.result || !state.outcome.trim()) return false;
  return state.next !== 'custom' || state.customDueAt !== '';
}

export function toLogCallInput(
  state: PostCallState,
  target: { context: CallContext; name: string; completeTaskId: string | null }
): LogCallInput | null {
  if (!state.result) return null;
  const next =
    state.next === 'none' ? null : state.next === 'custom' ? { due_at: state.customDueAt } : { preset: state.next };
  return {
    context: target.context,
    name: target.name,
    channel: state.channel,
    result: state.result,
    outcome: state.outcome.trim(),
    complete_task_id: target.completeTaskId,
    next,
  };
}

/** Rule 7 (AD-014, soft): an answered call that leaves an active deal with nothing next. */
export function showNoNextWarning(
  state: PostCallState,
  deal: { active: boolean; hasOtherPendingTask: boolean } | undefined
): boolean {
  return state.result === 'answered' && state.next === 'none' && !!deal?.active && !deal.hasOtherPendingTask;
}
