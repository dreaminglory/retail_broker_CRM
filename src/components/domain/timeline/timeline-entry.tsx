"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquare, CheckCircle2, ClipboardList, ArrowRightLeft, UserCircle2, Flag, Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NoteCard } from "@/components/domain/notes/note-card";
import { Badge } from "@/components/ui/badge";
import type { TimelineEntry } from "@/domain/timeline/types";
import { cn } from "@/lib/utils";

interface TimelineEntryProps {
  entry: TimelineEntry;
  currentUserId?: string;
  onUpdateNote?: (noteId: string, content: string, isPinned: boolean) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
}

export function TimelineEntryItem({ entry, currentUserId, onUpdateNote, onDeleteNote }: TimelineEntryProps) {
  const getIcon = () => {
    switch (entry.type) {
      case 'note': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'task': 
        return entry.isCompletionEvent 
          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
          : <ClipboardList className="h-4 w-4 text-orange-500" />;
      case 'audit':
        if (entry.data.action === 'stage_change') return <ArrowRightLeft className="h-4 w-4 text-purple-500" />;
        if (entry.data.action === 'assignment_change') return <UserCircle2 className="h-4 w-4 text-indigo-500" />;
        return <Flag className="h-4 w-4 text-gray-500" />;
      case 'inquiry': return <Mail className="h-4 w-4 text-cyan-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative pl-8 py-4">
      {/* Timeline line */}
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
      
      {/* Icon node */}
      <div className="absolute left-0 top-5 h-8 w-8 rounded-full border bg-background flex items-center justify-center z-10 shadow-sm">
        {getIcon()}
      </div>

      <div className="space-y-2">
        {entry.type === 'note' && onUpdateNote && onDeleteNote ? (
          <NoteCard 
            note={entry.data}
            currentUserId={currentUserId}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
          />
        ) : (
          <div className="p-4 rounded-lg border bg-card text-sm">
            <div className="flex justify-between items-start mb-2">
              <div className="font-semibold text-foreground">
                {entry.type === 'task' && (
                  entry.isCompletionEvent ? "Task Completed" : "Task Created"
                )}
                {entry.type === 'audit' && (
                  entry.data.action === 'stage_change' ? "Stage Changed" :
                  entry.data.action === 'assignment_change' ? "Assignment Changed" :
                  entry.data.action === 'status_change' ? "Status Changed" : "System Update"
                )}
                {entry.type === 'inquiry' && "New Inquiry Received"}
              </div>
              <div className="text-xs text-muted-foreground flex flex-col items-end gap-1">
                <span>{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
                {/* Author Info — uses display_name from profiles (Slice 4.2) */}
                {'author' in entry.data && entry.data.author && (
                  <span className="text-xs">
                    {entry.data.author.display_name || entry.data.author.email}
                  </span>
                )}
              </div>
            </div>

            {/* Entry Content */}
            {entry.type === 'task' && (
              <div className="text-muted-foreground">
                <p className="font-medium text-foreground">{entry.data.title}</p>
                {entry.isCompletionEvent && entry.data.outcome && (
                  <p className="mt-2 text-foreground p-3 bg-muted/30 rounded border border-dashed">
                    <span className="text-muted-foreground block text-xs mb-1 uppercase tracking-wider font-semibold">Outcome</span>
                    {entry.data.outcome}
                  </p>
                )}
              </div>
            )}

            {entry.type === 'audit' && (
              <div className="text-muted-foreground space-y-1">
                {entry.data.action === 'stage_change' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.data.metadata?.old_stage_name || entry.data.old_value}</Badge>
                    <ArrowRightLeft className="h-3 w-3" />
                    <Badge variant="default">{entry.data.metadata?.new_stage_name || entry.data.new_value}</Badge>
                  </div>
                )}
                {entry.data.action === 'assignment_change' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.data.metadata?.old_user_email || 'Unassigned'}</Badge>
                    <ArrowRightLeft className="h-3 w-3" />
                    <Badge variant="default">{entry.data.metadata?.new_user_email || 'Unassigned'}</Badge>
                  </div>
                )}
                {entry.data.action === 'status_change' && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.data.old_value}</Badge>
                    <ArrowRightLeft className="h-3 w-3" />
                    <Badge variant="default">{entry.data.new_value}</Badge>
                  </div>
                )}
              </div>
            )}

            {entry.type === 'inquiry' && (
              <div className="text-muted-foreground space-y-2">
                <div className="flex gap-2">
                  <Badge variant="secondary">{entry.data.status}</Badge>
                  {entry.data.source_description && <Badge variant="outline">{entry.data.source_description}</Badge>}
                </div>
                {entry.data.subject && <p className="font-medium text-foreground">{entry.data.subject}</p>}
                {entry.data.description && <p className="text-sm border-l-2 pl-3 py-1 text-muted-foreground/80 italic">{entry.data.description}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
