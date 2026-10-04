export type AuditEntityType = 'opportunity' | 'contact' | 'inquiry';
export type AuditAction = 'field_change' | 'status_change' | 'stage_change' | 'assignment_change' | 'created' | 'merged' | 'archived';

export interface AuditLogEntry {
  id: string;
  agency_id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  performed_by: string | null;
  performed_at: string;
}

export interface AuditLogEntryWithAuthor extends AuditLogEntry {
  author?: {
    id: string;
    email: string;
    /** Resolved from public.profiles (Slice 4.2). */
    display_name: string;
  } | null;
}
