/**
 * Matching (spec: matching; AD-060). The rules live in the database (`match_evaluate`); these
 * types describe what the two list functions return and what the service adds (names).
 */
import type { OpportunityStatus, OpportunityType } from '@/domain/opportunities/types';
import type { Construction, PropertyType } from '@/domain/properties/types';
import type { PropertyLinkStatus } from '@/domain/opportunity-properties/types';

export type MatchCriterionName = 'type' | 'rooms' | 'area_m2' | 'location' | 'budget' | 'floor' | 'construction';

export type MatchResult = 'match' | 'close' | 'miss' | 'unknown' | 'n/a';

/** One entry of `match_evaluate(...)->'criteria'`, in reading order. */
export type MatchCriterion = { criterion: MatchCriterionName; result: MatchResult; must: boolean };

export type ListingOfferType = 'sale' | 'rent';
export type MatchListingStatus = 'active' | 'reserved';

/** A row of `match_properties`, as the function returns it. */
export type PropertyMatchRow = {
  property_id: string;
  code: number;
  property_type: PropertyType;
  rooms: number | null;
  area_m2: number | null;
  plot_m2: number | null;
  floor: number | null;
  floors_total: number | null;
  construction: Construction | null;
  settlement_id: string;
  area_id: string | null;
  listing_id: string;
  offer_type: ListingOfferType;
  price: number;
  listing_status: MatchListingStatus;
  listed_at: string;
  score: number;
  criteria: MatchCriterion[];
  link_status: PropertyLinkStatus | null;
  total_count: number;
  unlinked_count: number;
};

/** A row of `match_opportunities`, as the function returns it. */
export type OpportunityMatchRow = {
  opportunity_id: string;
  opportunity_title: string;
  opportunity_type: OpportunityType;
  opportunity_status: OpportunityStatus;
  primary_contact_id: string | null;
  assigned_to: string | null;
  listing_id: string;
  offer_type: ListingOfferType;
  price: number;
  listing_status: MatchListingStatus;
  score: number;
  criteria: MatchCriterion[];
  link_status: PropertyLinkStatus | null;
  total_count: number;
  unlinked_count: number;
};

/** A property that fits a deal, with the location names in the caller's locale. */
export type PropertyMatch = Omit<PropertyMatchRow, 'settlement_id' | 'area_id' | 'total_count' | 'unlinked_count'> & {
  settlement_name: string;
  area_name: string | null;
};

/** A deal that fits a property, with the contact's and the broker's names. */
export type OpportunityMatch = Omit<OpportunityMatchRow, 'total_count' | 'unlinked_count'> & {
  contact_name: string | null;
  broker_name: string | null;
};

/** One page of matches. `total` is the rows in this view; `unlinked` the new matches. */
export type MatchPage<T> = { rows: T[]; total: number; unlinked: number; page: number; pageSize: number };

export type MatchPageOptions = { includeLinked?: boolean; page?: number; pageSize?: number };
