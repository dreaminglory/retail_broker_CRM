/**
 * What an inquiry card says about its calls (spec phone-loop rule 9): how long until the first
 * contact, the last logged call and a pending retry. Pure, so the mapping is unit-tested.
 */

import type { TaskChannel } from '@/domain/tasks/types';

export type ContactDelay = { unit: 'minutes' | 'hours' | 'days'; days: number; hours: number; minutes: number };

/** `contacted_at − received_at`, in the largest unit that reads well; never negative. */
export function contactDelay(receivedAt: string, contactedAt: string): ContactDelay {
  const total = Math.max(0, Math.floor((Date.parse(contactedAt) - Date.parse(receivedAt)) / 60_000));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const unit = days > 0 ? 'days' : hours > 0 ? 'hours' : 'minutes';
  return { unit, days, hours, minutes };
}

/** A task as the inquiry list embeds it. */
export type InquiryCallRow = {
  status: string;
  task_type: string | null;
  outcome: string | null;
  completed_at: string | null;
  due_at: string | null;
  channel: string | null;
};

export type InquiryCallSummary = {
  lastCall: { outcome: string | null; at: string; channel: TaskChannel | null } | null;
  /** The earliest pending call: a retry still to make. */
  nextRetryAt: string | null;
};

export function inquiryCallSummary(rows: InquiryCallRow[] | null | undefined): InquiryCallSummary {
  let lastCall: InquiryCallSummary['lastCall'] = null;
  let nextRetryAt: string | null = null;
  for (const row of rows ?? []) {
    if (row.status === 'completed' && (row.task_type === 'call' || row.task_type === 'email') && row.completed_at) {
      if (!lastCall || row.completed_at > lastCall.at) {
        lastCall = { outcome: row.outcome, at: row.completed_at, channel: row.channel as TaskChannel | null };
      }
    }
    if (row.status === 'pending' && row.task_type === 'call' && row.due_at) {
      if (!nextRetryAt || row.due_at < nextRetryAt) nextRetryAt = row.due_at;
    }
  }
  return { lastCall, nextRetryAt };
}
