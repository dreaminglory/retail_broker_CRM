/**
 * Call log types (spec phone-loop, AD-065). A logged call is a completed `call` or `email`
 * task with a `channel`; there is no call table.
 */

import type { Task } from '@/domain/tasks/types';
import type { DuePreset } from '@/domain/tasks/reschedule';

export const CALL_CHANNELS = ['phone', 'viber', 'whatsapp', 'email'] as const;
export type CallChannel = (typeof CALL_CHANNELS)[number];

export const CALL_RESULTS = ['answered', 'no_answer'] as const;
export type CallResult = (typeof CALL_RESULTS)[number];

/** Next-action presets after an answered call (rule 5); a custom date is also allowed. */
export const ANSWERED_PRESETS = ['tomorrow_9', 'plus_2d', 'next_monday_9'] as const satisfies readonly DuePreset[];
/** Retry presets after no answer (rule 5); `today_18` only before 17:00 agency time. */
export const RETRY_PRESETS = ['plus_1h', 'today_18', 'tomorrow_9'] as const satisfies readonly DuePreset[];

/** What a call is logged against (rule 2). `task_id` is the Today task that was tapped. */
export type CallContext = {
  opportunity_id?: string | null;
  contact_id?: string | null;
  inquiry_id?: string | null;
  task_id?: string | null;
};

export type CallNext = { preset: DuePreset } | { due_at: string };

export type LogCallInput = {
  context: CallContext;
  /** Who was called, for the task titles. */
  name: string;
  channel: CallChannel;
  result: CallResult;
  outcome: string;
  /** The pending call task the prompt said it completes; null or absent logs a separate call. */
  complete_task_id?: string | null;
  next: CallNext | null;
  new_stage_id?: string | null;
};

/** Task titles in the actor's language, already filled with the name (rule 6). */
export type CallTitles = { call: string; followUp: string; retry: string };

/** A call task as the database returns it, with the phone-loop columns. */
export type CallTask = Task & { channel: CallChannel | null; inquiry_id: string | null };

export type LogCallResult = { callTask: CallTask; nextTask?: CallTask };

/** The pending task a prompt offers to complete ("Completes: <title>"). */
export type CompletableTask = Pick<Task, 'id' | 'title' | 'due_at'>;
