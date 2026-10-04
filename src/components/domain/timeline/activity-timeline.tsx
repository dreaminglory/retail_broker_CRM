"use client";

import { useState, useEffect } from "react";
import { TimelineEntryItem } from "./timeline-entry";
import type { TimelineEntry } from "@/domain/timeline/types";
import { Button } from "@/components/ui/button";

interface ActivityTimelineProps {
  initialEntries: TimelineEntry[];
  currentUserId?: string;
  onUpdateNote?: (noteId: string, content: string, isPinned: boolean) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  onLoadMore?: (offset: number) => Promise<TimelineEntry[]>;
}

export function ActivityTimeline({ 
  initialEntries, 
  currentUserId, 
  onUpdateNote, 
  onDeleteNote,
  onLoadMore
}: ActivityTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initialEntries);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialEntries.length === 20); // assumption: if exactly 20, there might be more

  // Sync state when server components re-render and pass down new props (e.g. after a Server Action)
  useEffect(() => {
    setTimeout(() => {
      setEntries(initialEntries);
      setHasMore(initialEntries.length >= 20);
    }, 0);
  }, [initialEntries]);

  const handleLoadMore = async () => {
    if (!onLoadMore) return;
    setIsLoading(true);
    try {
      const newEntries = await onLoadMore(entries.length);
      setEntries(prev => [...prev, ...newEntries]);
      if (newEntries.length < 20) {
        setHasMore(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        {entries.map((entry, idx) => (
          <TimelineEntryItem 
            key={`${entry.type}-${entry.timestamp}-${idx}`} 
            entry={entry} 
            currentUserId={currentUserId}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
          />
        ))}
      </div>
      
      {entries.length === 0 && (
        <div className="text-center p-8 border rounded-lg bg-muted/10">
          <p className="text-sm text-muted-foreground">No activity history yet.</p>
        </div>
      )}

      {hasMore && onLoadMore && (
        <div className="pt-4 text-center border-t">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load older activity"}
          </Button>
        </div>
      )}
    </div>
  );
}
