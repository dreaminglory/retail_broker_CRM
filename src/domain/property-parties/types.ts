/**
 * Property parties: contacts with a role on a property (spec: properties). Ending a party keeps
 * the row, so the rows are the ownership history; there is no owner column on properties.
 */
import type { PropertyListItem } from '@/domain/properties/types';

export type PartyRole = 'owner' | 'co_owner' | 'representative' | 'occupant';

export type PropertyParty = {
  id: string;
  agency_id: string;
  property_id: string;
  contact_id: string;
  role: PartyRole;
  /** NULL while the party is current. */
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** A party on the property page, with the contact's name. */
export type PropertyPartyWithContact = PropertyParty & {
  contact: { id: string; display_name: string; status: string };
};

/** A contact's property, for the contact page. */
export type ContactPropertyParty = PropertyParty & {
  property: Pick<
    PropertyListItem,
    'id' | 'code' | 'type' | 'rooms' | 'status' | 'settlement_name' | 'area_name'
  >;
};
