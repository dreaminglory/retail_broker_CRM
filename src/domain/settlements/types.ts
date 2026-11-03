/**
 * Settlements: the global NSI EKATTE register, read-only (spec: properties; AD-056, AD-057).
 */

export type SettlementKind = 'city' | 'village';

export type SettlementRow = {
  id: string;
  ekatte: string;
  kind: SettlementKind;
  name_bg: string;
  name_en: string;
  municipality_bg: string;
  municipality_en: string;
  province_bg: string;
  province_en: string;
};

/** A settlement with its names in the user's locale (rule 9). */
export type Settlement = {
  id: string;
  kind: SettlementKind;
  name: string;
  municipality: string;
  province: string;
};
