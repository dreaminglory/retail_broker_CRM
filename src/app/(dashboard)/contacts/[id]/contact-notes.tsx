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
import { useTranslations } from "next-intl";

export function ContactNotes({
  notes,
  contactId,
  currentUserId,
}: {
  notes: Note[];
  contactId: string;
  currentUserId?: string;
}) {
  const t = useTranslations("ContactActivity");
  const pathname = usePathname();

  const handleCreate = async (content: string) => {
    const formData = new FormData();
    formData.append("content", content);
    const result = await createContactNoteAction(contactId, { success: true, data: undefined }, formData);
    if (!result.success) {
      toast.error(result.error || t("errors.create"));
      throw new Error(result.error || t("errors.create"));
    }
  };

  const handleUpdate = async (noteId: string, content: string, isPinned: boolean) => {
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

  const handleDelete = async (noteId: string) => {
    const result = await deleteNoteAction(noteId, pathname);
    if (!result.success) {
      toast.error(result.error || t("errors.delete"));
      throw new Error(result.error || t("errors.delete"));
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
