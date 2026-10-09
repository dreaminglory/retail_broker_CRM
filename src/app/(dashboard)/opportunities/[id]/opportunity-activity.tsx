"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ActivityTimeline } from "@/components/domain/timeline/activity-timeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus } from "lucide-react";
import type { TimelineEntry } from "@/domain/timeline/types";
import {
  updateNoteAction,
  deleteNoteAction,
} from "@/app/(dashboard)/contacts/[id]/notes/actions";
import { createOpportunityNoteAction } from "./notes/actions";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function OpportunityActivity({
  initialTimeline,
  opportunityId,
  currentUserId,
}: {
  initialTimeline: TimelineEntry[];
  opportunityId: string;
  currentUserId?: string;
}) {
  const t = useTranslations("ContactActivity");
  const pathname = usePathname();
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("content", newNoteContent);
      const result = await createOpportunityNoteAction(opportunityId, { success: true, data: undefined }, formData);
      if (!result.success) {
        toast.error(result.error || t("errors.create"));
        return;
      }
      setNewNoteContent("");
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string, content: string, isPinned: boolean) => {
    const formData = new FormData();
    formData.append("content", content);
    formData.append("is_pinned", isPinned ? "true" : "false");
    formData.append("pathname", pathname);

    const result = await updateNoteAction(noteId, { success: true, data: undefined }, formData);
    if (!result.success) {
      toast.error(result.error || t("errors.update"));
      throw new Error(result.error || t("errors.update"));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const result = await deleteNoteAction(noteId, pathname);
    if (!result.success) {
      toast.error(result.error || t("errors.delete"));
      throw new Error(result.error || t("errors.delete"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {isAdding ? (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <Textarea
              placeholder={t("placeholder")}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[100px] bg-background text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewNoteContent("");
                }}
                disabled={isSubmitting}
              >
                {t("cancelBtn")}
              </Button>
              <Button 
                size="sm" 
                onClick={handleCreateNote} 
                disabled={isSubmitting || !newNoteContent.trim()}
              >
                {isSubmitting ? t("savingBtn") : t("saveBtn")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground border-dashed bg-muted/30 hover:bg-muted/50"
            onClick={() => setIsAdding(true)}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            {t("addNoteBtn")}
          </Button>
        )}
      </div>

      <ActivityTimeline
        initialEntries={initialTimeline}
        currentUserId={currentUserId}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
      />
    </div>
  );
}
