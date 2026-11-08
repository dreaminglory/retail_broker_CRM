/**
 * Smart list domain types (spec: smart-lists, AD-062).
 * Built-in lists are code (`built-in.ts`); saved lists are rows of `smart_lists`.
 */

import type { Opportunity } from '../opportunities/types';
import type { Inquiry } from '../inquiries/types';
import type { InquiryListFilter, OpportunityListFilter, smartListEntitySchema } from './validation';
import type { z } from 'zod';

export type { InquiryListFilter, OpportunityListFilter };

export type SmartListEntity = z.infer<typeof smartListEntitySchema>;

/** Mine = assigned to the viewer; Agency = everyone's (owners and managers, AD-044). */
export type ListScope = 'mine' | 'agency';

export type BuiltInListId =
  | 'no-next-action'
  | 'overdue'
  | 'due-today'
  | 'hot-no-touch'
  | 'sellers-need-update'
  | 'new-matches'
  | 'unassigned-deals'
  | 'new-inquiries'
  | 'unassigned-inquiries';

/** A list filter of either entity, as the SQL list functions read it. */
export type ListFilter =
  | { entity: 'opportunity'; filter: OpportunityListFilter }
  | { entity: 'inquiry'; filter: InquiryListFilter };

/** A row of `smart_lists`: a saved (custom) list. */
export type SmartList = {
  id: string;
  agency_id: string;
  created_by: string;
  name: string;
  entity: SmartListEntity;
  /** As stored; may no longer parse (rule 5). */
  filter: unknown;
  shared: boolean;
  created_at: string;
  updated_at: string;
};

/** `[k1, id]`: the row's position in its list's order, for the queue (`p_after`). */
export type SortKey = [number, string];

export type OpportunityListRow = Opportunity & {
  last_touch: string;
  /** The deal's new matches: only on lists with `has_new_matches`, else null. */
  new_matches: number | null;
  sort_key: SortKey;
};

export type InquiryListRow = Inquiry & { sort_key: SortKey };

export type ListRows =
  | { entity: 'opportunity'; rows: OpportunityListRow[]; total: number }
  | { entity: 'inquiry'; rows: InquiryListRow[]; total: number };
