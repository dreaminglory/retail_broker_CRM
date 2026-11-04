"use client";

import { NotesActivity } from "@/components/domain/timeline/notes-activity";
import type { TimelineEntry } from "@/domain/timeline/types";
import { createPropertyNoteAction } from "./notes/actions";

export function PropertyActivity({
  initialTimeline,
  propertyId,
  currentUserId,
}: {
  initialTimeline: TimelineEntry[];
  propertyId: string;
  currentUserId?: string;
}) {
  return (
    <NotesActivity
      initialTimeline={initialTimeline}
      currentUserId={currentUserId}
      createNote={(formData) => createPropertyNoteAction(propertyId, { success: true, data: undefined }, formData)}
      showDeal
    />
  );
}
