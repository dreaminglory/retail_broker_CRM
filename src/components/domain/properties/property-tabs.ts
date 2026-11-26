/** The property page's tabs (property-detail.png), in order; `?tab=` holds one, Преглед is the default. */
export const PROPERTY_TABS = ["overview", "deals", "history"] as const;

export type PropertyTab = (typeof PROPERTY_TABS)[number];
