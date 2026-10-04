"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Edit2, Trash2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Note, NoteWithAuthor } from "@/domain/notes/types";
import { cn } from "@/lib/utils";

interface NoteCardProps {
  note: Note | NoteWithAuthor;
  currentUserId?: string;
  onUpdate: (noteId: string, content: string, isPinned: boolean) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

export function NoteCard({ note, currentUserId, onUpdate, onDelete }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canEdit = !currentUserId || note.created_by === currentUserId;

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === note.content) {
      setIsEditing(false);
      return;
    }
    setIsLoading(true);
    try {
      await onUpdate(note.id, editContent, note.is_pinned);
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePin = async () => {
    setIsLoading(true);
    try {
      await onUpdate(note.id, note.content, !note.is_pinned);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(note.id);
      setIsDeleting(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex gap-4 p-4 rounded-lg border bg-card transition-all",
          note.is_pinned && "border-primary/50 bg-primary/5"
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {(note as NoteWithAuthor).author?.display_name?.charAt(0).toUpperCase() ||
              (note as NoteWithAuthor).author?.email?.charAt(0).toUpperCase() ||
              'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">
                {(note as NoteWithAuthor).author?.display_name ||
                  (note as NoteWithAuthor).author?.email ||
                  'Team Member'}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
              </span>
              {note.is_pinned && (
                <Pin className="h-3 w-3 text-primary fill-primary" />
              )}
            </div>

            {canEdit && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-6 w-6 -mr-2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:bg-accent outline-none">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleTogglePin}>
                    <Pin className="mr-2 h-4 w-4" />
                    {note.is_pinned ? "Unpin note" : "Pin note"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit note
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setIsDeleting(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(note.content);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap mt-1">
              {note.content}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleting(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
