/** The deal page's tabs (deal.png), in order; `?tab=` holds one, Път is the default. */
export const DEAL_TABS = ["path", "properties", "requirements", "history"] as const;

export type DealTab = (typeof DEAL_TABS)[number];
