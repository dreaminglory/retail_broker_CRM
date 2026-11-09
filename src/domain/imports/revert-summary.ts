import type { ImportEntityType, RevertResult } from "./types";

export type RevertSummary =
  | { key: "revertSuccess"; values: { deleted: number; kept: number } }
  | {
      key: "revertSuccessProperty";
      values: {
        properties: number;
        contacts: number;
        areas: number;
        keptProperties: number;
        keptContacts: number;
        keptAreas: number;
      };
    };

/** The revert toast's message key and values: a property job names each kind (AD-064, M4). */
export function revertSummary(entityType: ImportEntityType, result: RevertResult): RevertSummary {
  const { deleted, kept } = result;
  if (entityType === "property") {
    return {
      key: "revertSuccessProperty",
      values: {
        properties: deleted.properties ?? 0,
        contacts: deleted.contacts,
        areas: deleted.areas ?? 0,
        keptProperties: kept.properties ?? 0,
        keptContacts: kept.contacts,
        keptAreas: kept.areas ?? 0,
      },
    };
  }
  return {
    key: "revertSuccess",
    values: { deleted: deleted.contacts + deleted.inquiries, kept: kept.contacts + kept.inquiries },
  };
}
