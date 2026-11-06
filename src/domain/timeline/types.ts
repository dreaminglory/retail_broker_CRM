import type { Note } from '@/domain/notes/types';
import type { Task } from '@/domain/tasks/types';
import type { AuditLogEntry } from '@/domain/audit/types';
import type { Inquiry } from '@/domain/inquiries/types';

export type TimelineEntryType = 'note' | 'task' | 'audit' | 'inquiry';

export interface AuthorInfo {
  id: string;
  email: string;
  /** Resolved from public.profiles (Slice 4.2). Falls back to email prefix if profile not found. */
  display_name: string;
}

export type TimelineNote = Note & { author?: AuthorInfo | null };
export type TimelineTask = Task & { author?: AuthorInfo | null };
export type TimelineAudit = AuditLogEntry & {
  author?: AuthorInfo | null;
  /** On the property timeline, the deal a `property_link` row belongs to. */
  opportunity?: { id: string; title: string } | null;
};
/**
 * On a deal's timeline, `joined` marks an inquiry that joined the deal instead of starting it
 * (AD-061); the inquiry's own `joined_at` is when. Unset on a contact's timeline.
 */
export type TimelineInquiry = Inquiry & { joined?: boolean };

export interface NoteTimelineEntry {
  type: 'note';
  timestamp: string;
  data: TimelineNote;
}

export interface TaskTimelineEntry {
  type: 'task';
  timestamp: string;
  data: TimelineTask;
  isCompletionEvent?: boolean;
}

export interface AuditTimelineEntry {
  type: 'audit';
  timestamp: string;
  data: TimelineAudit;
}

export interface InquiryTimelineEntry {
  type: 'inquiry';
  timestamp: string;
  data: TimelineInquiry;
}

export type TimelineEntry =
  | NoteTimelineEntry
  | TaskTimelineEntry
  | AuditTimelineEntry
  | InquiryTimelineEntry;
