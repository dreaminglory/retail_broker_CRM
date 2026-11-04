/**
 * Areas: an agency's districts (квартали) in one settlement (spec: properties; T6).
 */
import type { Settlement } from '@/domain/settlements/types';

export type Area = {
  id: string;
  agency_id: string;
  settlement_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** A settlement the agency has areas in, with how many (Settings → Areas). */
export type SettlementAreaCount = {
  settlement: Settlement;
  count: number;
};
