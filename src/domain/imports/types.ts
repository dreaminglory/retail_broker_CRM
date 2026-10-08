export type ImportEntityType = 'contact' | 'inquiry';

export type ImportJobStatus = 
  | 'draft'
  | 'staged'
  | 'validated'
  | 'committing'
  | 'completed'
  | 'failed'
  | 'reverted';

export type ImportRowStatus = 
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'duplicate'
  | 'created'
  | 'updated'
  | 'skipped'
  | 'error'
  | 'reverted';

export type DuplicateStrategy = 'skip' | 'update' | 'create';

export interface ImportJob {
  id: string;
  agency_id: string;
  entity_type: ImportEntityType;
  status: ImportJobStatus;
  file_name: string;
  file_sha256: string;
  file_size_bytes: number;
  encoding: 'utf-8' | 'windows-1251';
  delimiter: string;
  headers: string[];
  column_mapping: Record<string, string | null>;
  options: {
    duplicate_strategy?: DuplicateStrategy;
    default_contact_type?: 'person' | 'organization';
    default_source_id?: string | null;
    unknown_source?: 'use_default' | 'error';
    default_assigned_to?: string | null;
    default_status?: string;
    link_contacts?: boolean;
    create_missing_contacts?: boolean;
    date_format?: string;
  };
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  created_by: string | null;
  completed_at: string | null;
  reverted_at: string | null;
  reverted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportError {
  code: string;
  field?: string;
  detail?: string;
}

export type MatchReason = 'phone' | 'email' | 'external_ref' | 'in_file' | 'name_similar';

export interface ImportRow {
  id: string;
  agency_id: string;
  import_job_id: string;
  row_number: number;
  raw: Record<string, string>;
  normalized: Record<string, any> | null;
  status: ImportRowStatus;
  errors: ImportError[];
  match_reason: MatchReason | null;
  matched_entity_id: string | null;
  entity_id: string | null;
  created_at: string;
}

export type ContactImportField = 
  | 'full_name' 
  | 'first_name' 
  | 'last_name' 
  | 'company_name' 
  | 'contact_type' 
  | 'phone' 
  | 'phone_2' 
  | 'email' 
  | 'email_2' 
  | 'viber' 
  | 'whatsapp' 
  | 'note' 
  | 'external_ref';

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  completed: boolean;
  brokerImpact?: { userId: string; name: string; newInquiries: number }[];
}

export type InquiryImportField = 
  | 'caller_name'
  | 'caller_phone'
  | 'caller_email'
  | 'subject'
  | 'description'
  | 'source'
  | 'external_ref'
  | 'received_at'
  | 'assigned_to'
  | 'status';
