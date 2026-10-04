"use client";

import { usePathname } from "next/navigation";
import { NoteList } from "@/components/domain/notes/note-list";
import type { Note } from "@/domain/notes/types";
import {
  createContactNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "./notes/actions";
import { toast } from "sonner";

export function ContactNotes({
  notes,
  contactId,
  currentUserId,
}: {
  notes: Note[];
  contactId: string;
  currentUserId?: string;
}) {
  const pathname = usePathname();

  const handleCreate = async (content: string) => {
    const formData = new FormData();
    formData.append("content", content);
    const result = await createContactNoteAction(contactId, { success: true, data: undefined as unknown }, formData);
    if (!result.success) {
      toast.error(result.error || "Failed to create note");
      throw new Error(result.error || "Failed to create note");
    }
  };

  const handleUpdate = async (noteId: string, content: string, isPinned: boolean) => {
    const formData = new FormData();
    formData.append("content", content);
    formData.append("is_pinned", isPinned ? "true" : "false");
    formData.append("pathname", pathname);

    const result = await updateNoteAction(noteId, { success: true, data: undefined as unknown }, formData);
    if (!result.success) {
      toast.error(result.error || "Failed to update note");
      throw new Error(result.error || "Failed to update note");
    }
  };

  const handleDelete = async (noteId: string) => {
    const result = await deleteNoteAction(noteId, pathname);
    if (!result.success) {
      toast.error(result.error || "Failed to delete note");
      throw new Error(result.error || "Failed to delete note");
    }
  };

  return (
    <NoteList
      notes={notes}
      currentUserId={currentUserId}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
}
