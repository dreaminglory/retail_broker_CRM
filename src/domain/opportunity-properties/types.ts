/**
 * Links between opportunities and properties (spec: properties, rules 5–7; AD-057).
 * Buyer and tenant deals have `candidate` links with a status; seller and landlord deals have
 * one `subject` link without one. Every change is audited on the opportunity (`property_link`).
 */
import type { Opportunity } from '@/domain/opportunities/types';
import type { PropertyListItem } from '@/domain/properties/types';

export type PropertyLinkRelation = 'subject' | 'candidate';

export type PropertyLinkStatus = 'candidate' | 'viewed' | 'offered' | 'rejected' | 'selected';

/** How a link came to exist (AD-060): set on insert, never changed. */
export type PropertyLinkSource = 'manual' | 'match' | 'viewing';

export type OpportunityProperty = {
  id: string;
  agency_id: string;
  opportunity_id: string;
  property_id: string;
  relation: PropertyLinkRelation;
  /** Set on candidates only; NULL on a subject link. */
  status: PropertyLinkStatus | null;
  /** Only on a rejected candidate. */
  rejected_reason: string | null;
  source: PropertyLinkSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The property fields a link shows. */
export type LinkedProperty = Pick<
  PropertyListItem,
  'id' | 'code' | 'type' | 'rooms' | 'area_m2' | 'address' | 'status' | 'settlement_name' | 'area_name'
>;

/** A link on the opportunity page. */
export type OpportunityPropertyWithProperty = OpportunityProperty & { property: LinkedProperty };

/** A link on the property page. */
export type PropertyOpportunityLink = OpportunityProperty & {
  opportunity: Pick<Opportunity, 'id' | 'title' | 'type' | 'status'>;
};
