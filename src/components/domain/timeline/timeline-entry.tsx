"use client";

import { useRelativeTime } from "@/lib/i18n/use-relative-time";
import { MessageSquare, CheckCircle2, ClipboardList, ArrowRightLeft, UserCircle2, Flag, Mail, Plus, Link2, Tag, ListChecks } from "lucide-react";
import { NoteCard } from "@/components/domain/notes/note-card";
import { Badge } from "@/components/ui/badge";
import type { TimelineEntry } from "@/domain/timeline/types";
import { describeAudit } from "@/domain/timeline/audit-event";
import { useFormatter, useTranslations } from "next-intl";
import { AuditEventBody, auditEventTitle } from "./audit-event-view";

interface TimelineEntryProps {
  entry: TimelineEntry;
  currentUserId?: string;
  onUpdateNote?: (noteId: string, content: string, isPinned: boolean) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  /** On the property timeline, link rows name their deal instead of the property. */
  showDeal?: boolean;
}

export function TimelineEntryItem({ entry, currentUserId, onUpdateNote, onDeleteNote, showDeal }: TimelineEntryProps) {
  const t = useTranslations("Timeline");
  const ago = useRelativeTime();
  const format = useFormatter();
  const tInquiry = useTranslations("InquiryCard");
  const event = entry.type === 'audit' ? describeAudit(entry.data) : null;

  const getIcon = () => {
    switch (entry.type) {
      case 'note': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'task': 
        return entry.isCompletionEvent 
          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
          : <ClipboardList className="h-4 w-4 text-orange-500" />;
      case 'audit':
        switch (event?.kind) {
          case 'created':
          case 'propertyCreated':
          case 'listingCreated':
            return <Plus className="h-4 w-4 text-emerald-500" />;
          case 'stage':
            return <ArrowRightLeft className="h-4 w-4 text-purple-500" />;
          case 'assignment':
            return <UserCircle2 className="h-4 w-4 text-indigo-500" />;
          case 'listingPrice':
            return <Tag className="h-4 w-4 text-amber-500" />;
          case 'propertyLink':
            return <Link2 className="h-4 w-4 text-sky-500" />;
          case 'requirement':
            return <ListChecks className="h-4 w-4 text-teal-500" />;
          default:
            return <Flag className="h-4 w-4 text-gray-500" />;
        }
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
          <div className="p-4 rounded-lg border bg-card text-sm" data-testid="timeline-entry">
            <div className="flex justify-between items-start mb-2">
              <div className="font-semibold text-foreground">
                {entry.type === 'task' && (
                  entry.isCompletionEvent ? t("events.taskCompleted") : t("events.taskCreated")
                )}
                {event && auditEventTitle(t, event)}
                {entry.type === 'inquiry' && (entry.data.joined ? t("events.joinedInquiry") : t("events.newInquiry"))}
              </div>
              <div className="text-xs text-muted-foreground flex flex-col items-end gap-1">
                <span>{ago(entry.timestamp)}</span>
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
                    <span className="text-muted-foreground block text-xs mb-1 uppercase tracking-wider font-semibold">{t("outcomeLabel")}</span>
                    {entry.data.outcome}
                  </p>
                )}
              </div>
            )}

            {entry.type === 'audit' && event && (
              <div className="text-muted-foreground space-y-1">
                <AuditEventBody event={event} data={entry.data} showDeal={showDeal} />
              </div>
            )}

            {entry.type === 'inquiry' && (
              <div className="text-muted-foreground space-y-2">
                <div className="flex gap-2">
                  <Badge variant="secondary">{tInquiry(`status.${entry.data.status}` as never)}</Badge>
                  {entry.data.source_description && <Badge variant="outline">{entry.data.source_description}</Badge>}
                </div>
                {entry.data.joined && entry.data.joined_at && (
                  <p className="text-xs" data-testid="inquiry-joined-on">
                    {t("inquiryJoinedOn", {
                      date: format.dateTime(new Date(entry.data.joined_at), { dateStyle: "medium", timeStyle: "short" }),
                    })}
                  </p>
                )}
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
