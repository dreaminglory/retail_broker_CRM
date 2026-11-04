import type { Property } from "@/domain/properties/types";

/** next-intl's translator for the `Enums` namespace, on the server or the client. */
type EnumsTranslator = (key: string, values?: Record<string, string | number>) => string;

/**
 * "Двустаен" / "2-room apartment" for an apartment (derived from rooms), else the type name.
 */
export function propertyHeadline(enums: EnumsTranslator, property: Pick<Property, "type" | "rooms">): string {
  if (property.type === "apartment" && property.rooms) {
    return enums("propertyRooms", { rooms: String(property.rooms) });
  }
  return enums(`propertyType.${property.type}`);
}

/** "#1042" */
export function propertyCode(property: Pick<Property, "code">): string {
  return `#${property.code}`;
}
