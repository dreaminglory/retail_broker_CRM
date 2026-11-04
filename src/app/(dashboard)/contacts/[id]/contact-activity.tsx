"use client";

import { NotesActivity } from "@/components/domain/timeline/notes-activity";
import type { TimelineEntry } from "@/domain/timeline/types";
import { createContactNoteAction } from "./notes/actions";

export function ContactActivity({
  initialTimeline,
  contactId,
  currentUserId,
}: {
  initialTimeline: TimelineEntry[];
  contactId: string;
  currentUserId?: string;
}) {
  return (
    <NotesActivity
      initialTimeline={initialTimeline}
      currentUserId={currentUserId}
      createNote={(formData) => createContactNoteAction(contactId, { success: true, data: undefined }, formData)}
    />
  );
}
