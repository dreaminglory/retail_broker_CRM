/**
 * Notification domain types (AD-042, AD-051).
 * The digest types carry names and task titles only: no phone, email, note or inquiry subject
 * (spec/reminders.md rule 3), so a template can't leak what the builder never receives.
 */

import type { MemberRole } from '@/domain/members/types';

export type NotificationKind = 'daily_digest' | 'inquiry_assigned';

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type NotificationLocale = 'bg' | 'en';

/** An active member eligible for the digest. */
export type DigestRecipient = {
  userId: string;
  email: string;
  name: string;
  locale: NotificationLocale;
  role: MemberRole;
};

/** A pending task, as loaded for the digest. */
export type DigestTaskInput = { id: string; title: string; dueAt: string; assignedTo: string };

/** A `new` inquiry, as loaded for the digest. */
export type DigestInquiryInput = { id: string; callerName: string | null; receivedAt: string; assignedTo: string | null };

export type DigestTaskRow = { id: string; title: string; dueAt: string };
export type DigestInquiryRow = { id: string; callerName: string | null };

/** At most `DIGEST_MAX_ROWS` rows; `more` is how many were left out ("+N more"). */
export type DigestSection<Row> = { rows: Row[]; more: number };

/** The whole agency's numbers, same definitions as Exceptions. Owners and managers only. */
export type AgencyCounts = { unassignedInquiries: number; overdueTasks: number };

export type Digest = {
  overdue: DigestSection<DigestTaskRow>;
  dueToday: DigestSection<DigestTaskRow>;
  newInquiries: DigestSection<DigestInquiryRow>;
  /** Null for a broker, and when both counts are zero. */
  agency: AgencyCounts | null;
};
