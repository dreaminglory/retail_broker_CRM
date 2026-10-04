export interface Note {
  id: string;
  agency_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  content: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Note with resolved author information from public.profiles (Slice 4.2).
 * Used in note-card and timeline renderers.
 */
export interface NoteWithAuthor extends Note {
  author?: {
    id: string;
    email: string;
    display_name: string;
  } | null;
}

export interface CreateNoteInput {
  contact_id?: string;
  opportunity_id?: string;
  content: string;
  is_pinned?: boolean;
}

export interface UpdateNoteInput {
  content?: string;
  is_pinned?: boolean;
}
