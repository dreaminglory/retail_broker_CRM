"use client";

import { NotesActivity } from "@/components/domain/timeline/notes-activity";
import type { TimelineEntry } from "@/domain/timeline/types";
import { createOpportunityNoteAction } from "./notes/actions";

export function OpportunityActivity({
  initialTimeline,
  opportunityId,
  currentUserId,
}: {
  initialTimeline: TimelineEntry[];
  opportunityId: string;
  currentUserId?: string;
}) {
  return (
    <NotesActivity
      initialTimeline={initialTimeline}
      currentUserId={currentUserId}
      createNote={(formData) => createOpportunityNoteAction(opportunityId, { success: true, data: undefined }, formData)}
    />
  );
}
