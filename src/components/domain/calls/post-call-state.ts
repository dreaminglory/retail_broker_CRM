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
  /** A new stage for the deal after an answered call (rule 5); null keeps it. */
  stageId: string | null;
};

/** A deal a call can be logged on (rules 2, 7, 8). */
export type CallDeal = {
  id: string;
  title: string;
  stageId: string;
  /** Status 'active': stage change and the rule 7 warning apply. */
  active: boolean;
  /** Its pending tasks of anyone, for the rule 7 warning. */
  pendingTaskCount: number;
};

/** The deal side of a prompt target: one deal, or a contact's several active deals to pick from. */
export type CallDealTarget = {
  context: CallContext;
  deal?: CallDeal;
  dealChoices?: CallDeal[];
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
  return { result: null, outcome: '', outcomePrefilled: false, next: 'none', customDueAt: '', channel, stageId: null };
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
  target: { context: CallContext; name: string; completeTaskId: string | null; currentStageId?: string | null }
): LogCallInput | null {
  if (!state.result) return null;
  const newStage = state.result === 'answered' && state.stageId && state.stageId !== target.currentStageId ? state.stageId : null;
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
    ...(newStage && { new_stage_id: newStage }),
  };
}

/** The deal the call is logged on: the picked one among the choices, else the target's own. */
export function callDeal(target: CallDealTarget, pickedDealId: string | null): CallDeal | undefined {
  if (target.dealChoices?.length) return target.dealChoices.find((d) => d.id === pickedDealId);
  return target.deal;
}

/** The context sent to the server, with the picked deal (rule 2: "no deal" logs on the contact). */
export function callContext(target: CallDealTarget, pickedDealId: string | null): CallContext {
  if (!target.dealChoices?.length) return target.context;
  const deal = callDeal(target, pickedDealId);
  return deal ? { ...target.context, opportunity_id: deal.id } : target.context;
}

/**
 * Rule 7 (AD-014, soft): an answered call that leaves an active deal with nothing next. The
 * task the call completes no longer counts as next.
 */
export function showNoNextWarning(
  state: PostCallState,
  deal: Pick<CallDeal, 'active' | 'pendingTaskCount'> | undefined,
  completing: boolean
): boolean {
  if (state.result !== 'answered' || state.next !== 'none' || !deal?.active) return false;
  return deal.pendingTaskCount - (completing ? 1 : 0) <= 0;
}
