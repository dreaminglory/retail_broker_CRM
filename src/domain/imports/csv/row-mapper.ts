import { ContactImportOptionsInput } from "../validation";
import type { ImportError } from "../types";
import type { ListingStatus } from "@/domain/listings/types";
import type { Construction, PropertyType } from "@/domain/properties/types";
import { propertyFormSchema, type PropertyFormValues } from "@/domain/properties/validation";
import {
  normalizeAreaName,
  parseNumber,
  parsePrice,
  resolveConstruction,
  resolveFloor,
  resolveListingStatus,
  resolvePropertyType,
  type ParsedPrice,
} from "./property-resolvers";

/** One property CSV row read through the column mapping, before any lookups (AD-064). */
export interface PropertyCandidate {
  type: PropertyType | null;
  /** The cell as written, kept when the type word is unknown. */
  type_value: string | null;
  rooms: number | null;
  area_m2: number | null;
  plot_m2: number | null;
  floor: number | null;
  floors_total: number | null;
  year_built: number | null;
  construction: Construction | null;
  settlement: string | null;
  municipality: string | null;
  province: string | null;
  area: string | null;
  address: string | null;
  location_note: string | null;
  description: string | null;
  external_ref: string | null;
  sale_price: ParsedPrice | null;
  rent_price: ParsedPrice | null;
  /** null when the cell has a status word nobody knows. */
  listing_status: ListingStatus | null;
  listed_at: string | null;
  assigned_to: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
}

export function mapRowToPropertyCandidate(
  rawRow: Record<string, string>,
  mapping: Record<string, string | null>
): PropertyCandidate {
  const getValue = (field: string): string | null => {
    const headerName = mapping[field];
    if (!headerName) return null;
    const value = rawRow[headerName];
    if (!value || value.trim() === "") return null;
    return value.trim();
  };

  const typeValue = getValue("type");
  const resolvedType = resolvePropertyType(typeValue);
  // A rooms column wins over the rooms a word like "двустаен" implies.
  const rooms = parseNumber(getValue("rooms")) ?? resolvedType?.rooms ?? null;

  return {
    type: resolvedType?.type ?? null,
    type_value: typeValue,
    rooms,
    area_m2: parseNumber(getValue("area_m2")),
    plot_m2: parseNumber(getValue("plot_m2")),
    floor: resolveFloor(getValue("floor")),
    floors_total: parseNumber(getValue("floors_total")),
    year_built: parseNumber(getValue("year_built")),
    construction: resolveConstruction(getValue("construction")),
    settlement: getValue("settlement"),
    municipality: getValue("municipality"),
    province: getValue("province"),
    area: normalizeAreaName(getValue("area")),
    address: getValue("address"),
    location_note: getValue("location_note"),
    description: getValue("description"),
    external_ref: getValue("external_ref"),
    sale_price: parsePrice(getValue("sale_price")),
    rent_price: parsePrice(getValue("rent_price")),
    listing_status: resolveListingStatus(getValue("listing_status")),
    listed_at: getValue("listed_at"),
    assigned_to: getValue("assigned_to"),
    owner_name: getValue("owner_name"),
    owner_phone: getValue("owner_phone"),
    owner_email: getValue("owner_email"),
  };
}

export type PropertyAttributesResult =
  | { success: true; data: PropertyFormValues }
  | { success: false; errors: ImportError[] };

/**
 * Rule 1: a row is a valid property exactly when the property form would accept it, so the
 * candidate goes through `propertyFormSchema` itself, never a copy. Errors keep the form's
 * i18n codes, one per field.
 */
export function parsePropertyAttributes(
  candidate: PropertyCandidate,
  ids: { settlement_id: string | null; area_id: string | null; assigned_to: string | null }
): PropertyAttributesResult {
  const parsed = propertyFormSchema.safeParse({
    type: candidate.type ?? candidate.type_value ?? undefined,
    rooms: candidate.rooms,
    area_m2: candidate.area_m2,
    plot_m2: candidate.plot_m2,
    floor: candidate.floor,
    floors_total: candidate.floors_total,
    construction: candidate.construction,
    year_built: candidate.year_built,
    settlement_id: ids.settlement_id,
    area_id: ids.area_id,
    address: candidate.address,
    location_note: candidate.location_note,
    description: candidate.description,
    assigned_to: ids.assigned_to,
  });
  if (parsed.success) return { success: true, data: parsed.data };

  const seen = new Set<string>();
  const errors: ImportError[] = [];
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "type");
    if (seen.has(field)) continue;
    seen.add(field);
    errors.push({ field, code: issue.message });
  }
  return { success: false, errors };
}

export interface ContactCandidate {
  contact_type: "person" | "organization";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  email_2: string | null;
  viber: string | null;
  whatsapp: string | null;
  note: string | null;
  external_ref: string | null;
}

export function mapRowToCandidate(
  rawRow: Record<string, string>,
  mapping: Record<string, string | null>,
  options: ContactImportOptionsInput
): ContactCandidate {
  // Extract values using the mapping
  const getValue = (field: string): string | null => {
    const headerName = mapping[field];
    if (!headerName) return null;
    const value = rawRow[headerName];
    if (!value || value.trim() === "") return null;
    return value.trim();
  };

  const rawFullName = getValue("full_name");
  let firstName = getValue("first_name");
  let lastName = getValue("last_name");
  let companyName = getValue("company_name");
  const rawContactType = getValue("contact_type")?.toLowerCase();

  let contactType: "person" | "organization" = options.default_contact_type || "person";
  
  if (rawContactType) {
    if (["organization", "фирма", "company", "юридическо лице", "org"].includes(rawContactType)) {
      contactType = "organization";
    } else if (["person", "лице", "физическо лице", "individual"].includes(rawContactType)) {
      contactType = "person";
    }
  } else if (!firstName && !lastName && companyName) {
    // Infer organization if no person name but has company name
    contactType = "organization";
  }

  // Handle full name splitting if first/last are not explicitly provided
  if (rawFullName) {
    if (contactType === "organization" && !companyName) {
      // For organizations, treat full name as company name
      companyName = rawFullName;
    } else if (contactType === "person" && (!firstName && !lastName)) {
      const parts = rawFullName.split(/\s+/);
      if (parts.length > 0) {
        firstName = parts[0];
        if (parts.length > 1) {
          lastName = parts.slice(1).join(" ");
        }
      }
    }
  }

  return {
    contact_type: contactType,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    phone: getValue("phone"),
    phone_2: getValue("phone_2"),
    email: getValue("email"),
    email_2: getValue("email_2"),
    viber: getValue("viber"),
    whatsapp: getValue("whatsapp"),
    note: getValue("note"),
    external_ref: getValue("external_ref"),
  };
}

export interface InquiryCandidate {
  caller_name: string | null;
  caller_phone: string | null;
  caller_email: string | null;
  subject: string | null;
  description: string | null;
  source: string | null;
  external_ref: string | null;
  received_at: string | null;
  assigned_to: string | null;
  status: string | null;
}

export function mapRowToInquiryCandidate(
  rawRow: Record<string, string>,
  mapping: Record<string, string | null>
): InquiryCandidate {
  const getValue = (field: string): string | null => {
    const headerName = mapping[field];
    if (!headerName) return null;
    const value = rawRow[headerName];
    if (!value || value.trim() === "") return null;
    return value.trim();
  };

  return {
    caller_name: getValue("caller_name"),
    caller_phone: getValue("caller_phone"),
    caller_email: getValue("caller_email"),
    subject: getValue("subject"),
    description: getValue("description"),
    source: getValue("source"),
    external_ref: getValue("external_ref"),
    received_at: getValue("received_at"),
    assigned_to: getValue("assigned_to"),
    status: getValue("status"),
  };
}
