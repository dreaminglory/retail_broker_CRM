"use client";

import { ActivityTimeline } from "@/components/domain/timeline/activity-timeline";
import type { TimelineEntry } from "@/domain/timeline/types";

/** The property's history (AD-057): its own changes, its listings, link changes and viewings. */
export function PropertyActivity({ initialTimeline }: { initialTimeline: TimelineEntry[] }) {
  return <ActivityTimeline initialEntries={initialTimeline} showDeal />;
}
