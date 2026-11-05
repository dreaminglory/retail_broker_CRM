/**
 * Requirements: what a buyer or tenant is looking for, on the opportunity itself (spec:
 * requirements; AD-059). One per buyer or tenant deal; the budget is a price on a buyer deal
 * and a monthly rent on a tenant deal, so the offer type is never stored.
 */
import type { Construction, PropertyType } from '@/domain/properties/types';

export type Financing = 'cash' | 'mortgage' | 'mixed' | 'unknown';

/** The criteria a must-have flag can be set on (rule 4). */
export type MustCriterion = 'budget' | 'location' | 'type' | 'rooms' | 'area_m2' | 'floor' | 'construction';

export type RequirementRow = {
  id: string;
  agency_id: string;
  opportunity_id: string;
  budget_min: number | null;
  budget_max: number | null;
  /** Empty = any. */
  property_types: PropertyType[];
  rooms_min: number | null;
  rooms_max: number | null;
  area_m2_min: number | null;
  area_m2_max: number | null;
  /** The ground floor (партер) is floor 1. */
  floor_min: number | null;
  floor_max: number | null;
  not_top_floor: boolean;
  /** Empty = any. */
  construction: Construction[];
  /** Shown, never matched. */
  financing: Financing;
  /** Shown, never matched. */
  wishes: string | null;
  budget_must: boolean;
  location_must: boolean;
  type_must: boolean;
  rooms_must: boolean;
  area_m2_must: boolean;
  floor_must: boolean;
  construction_must: boolean;
  /** Sorted `settlement_id` / `settlement_id:area_id`, written by `save_requirement`. */
  location_keys: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** A location with its names; `area_id` null = the whole settlement. */
export type RequirementLocation = {
  settlement_id: string;
  settlement_name: string;
  area_id: string | null;
  area_name: string | null;
  /** False for an area the agency has since deactivated (rule 6); null for a whole settlement. */
  area_active: boolean | null;
};

/** A requirement as the opportunity page shows it, names in the user's locale. */
export type Requirement = RequirementRow & { locations: RequirementLocation[] };
