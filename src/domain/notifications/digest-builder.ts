import { getTodayWindows } from '@/lib/time/agency-day';
import type {
  Digest,
  DigestInquiryInput,
  DigestInquiryRow,
  DigestSection,
  DigestTaskInput,
  DigestTaskRow,
} from './types';

export const DIGEST_MAX_ROWS = 10;

type BuildDigestInput = {
  userId: string;
  tasks: DigestTaskInput[];
  inquiries: DigestInquiryInput[];
  timezone: string;
  now: Date;
};

function cap<Row>(rows: Row[]): DigestSection<Row> {
  return { rows: rows.slice(0, DIGEST_MAX_ROWS), more: Math.max(0, rows.length - DIGEST_MAX_ROWS) };
}

const byDueAt = (a: DigestTaskRow, b: DigestTaskRow) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();

/**
 * One member's digest, or null when every section is empty (no email then).
 * Sections follow Today (`docs/domain-model.md` §4): overdue is `due < now`, due today is from
 * now to agency midnight. The input may hold the whole agency's rows: only this member's count.
 */
export function buildDigest({ userId, tasks, inquiries, timezone, now }: BuildDigestInput): Digest | null {
  const windows = getTodayWindows(timezone, now);
  const nowMs = new Date(windows.overdueBefore).getTime();
  const midnightMs = new Date(windows.dueToday.before).getTime();

  const overdue: DigestTaskRow[] = [];
  const dueToday: DigestTaskRow[] = [];
  for (const task of tasks) {
    if (task.assignedTo !== userId) continue;
    const dueMs = new Date(task.dueAt).getTime();
    const row = { id: task.id, title: task.title, dueAt: task.dueAt };
    if (dueMs < nowMs) overdue.push(row);
    else if (dueMs < midnightMs) dueToday.push(row);
  }

  const newInquiries: DigestInquiryRow[] = inquiries
    .filter((inquiry) => inquiry.assignedTo === userId)
    .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
    .map((inquiry) => ({ id: inquiry.id, callerName: inquiry.callerName }));

  if (overdue.length === 0 && dueToday.length === 0 && newInquiries.length === 0) return null;

  return {
    overdue: cap(overdue.sort(byDueAt)),
    dueToday: cap(dueToday.sort(byDueAt)),
    newInquiries: cap(newInquiries),
  };
}
