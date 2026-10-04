/**
 * Stage domain types.
 * AD-006: Pipeline configurability deferred to Sprint 2.
 * Sprint 1 provides seeded defaults only.
 */

export type TerminalType = 'won' | 'lost' | 'nurture';

export interface Stage {
  id: string;
  agency_id: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  /** Null for non-terminal stages. */
  terminal_type: TerminalType | null;
  created_at: string;
  updated_at: string;
}
