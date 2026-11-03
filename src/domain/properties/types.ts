/**
 * Property domain types (spec: properties; AD-056, AD-057).
 * A property is the physical asset; price and offer live on listings, owners on parties.
 */
import type { Area } from '@/domain/areas/types';
import type { Settlement } from '@/domain/settlements/types';

export type PropertyType = 'apartment' | 'studio' | 'maisonette' | 'house' | 'house_floor' | 'plot' | 'garage';

export type Construction = 'brick' | 'panel' | 'epk' | 'timber' | 'other';

export type PropertyStatus = 'active' | 'archived';

export type Property = {
  id: string;
  agency_id: string;
  /** Per-agency number shown as #1042, set by the database (L9). */
  code: number;
  type: PropertyType;
  rooms: number | null;
  area_m2: number | null;
  plot_m2: number | null;
  floor: number | null;
  floors_total: number | null;
  construction: Construction | null;
  year_built: number | null;
  settlement_id: string;
  area_id: string | null;
  address: string | null;
  location_note: string | null;
  assigned_to: string | null;
  description: string | null;
  status: PropertyStatus;
  external_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** A row of the property list, with its location names in the user's locale. */
export type PropertyListItem = Property & {
  settlement_name: string;
  area_name: string | null;
};

/** A property with its location names and responsible broker, for its page. */
export type PropertyDetail = Property & {
  settlement: Settlement;
  area: Pick<Area, 'id' | 'name'> | null;
  assignee: { id: string; display_name: string } | null;
};
