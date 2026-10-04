"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NoteCard } from "./note-card";
import type { Note } from "@/domain/notes/types";
import { MessageSquarePlus } from "lucide-react";

interface NoteListProps {
  notes: Note[];
  currentUserId?: string;
  onCreate: (content: string) => Promise<void>;
  onUpdate: (noteId: string, content: string, isPinned: boolean) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

export function NoteList({ notes, currentUserId, onCreate, onUpdate, onDelete }: NoteListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newNoteContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onCreate(newNoteContent);
      setNewNoteContent("");
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {isAdding ? (
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
          <Textarea
            placeholder="Write your note here..."
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
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleCreate} 
              disabled={isSubmitting || !newNoteContent.trim()}
            >
              {isSubmitting ? "Saving..." : "Save note"}
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
          Add a note...
        </Button>
      )}

      {notes.length === 0 ? (
        <div className="text-center p-8 border rounded-lg bg-muted/10">
          <p className="text-sm text-muted-foreground">No notes yet. Be the first to add one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={currentUserId}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
