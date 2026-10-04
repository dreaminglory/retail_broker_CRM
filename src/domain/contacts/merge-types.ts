import type { ContactWithMethods } from './types';

export interface MergeHistory {
  id: string;
  agency_id: string;
  winner_contact_id: string;
  loser_contact_id: string;
  merged_by: string;
  merged_at: string;
  loser_snapshot: ContactWithMethods;
}

export interface MergePreview {
  winnerId: string;
  loserId: string;
  opportunitiesToTransfer: number;
  inquiriesToTransfer: number;
  tasksToTransfer: number;
  contactMethodsToTransfer: number;
}
