import type { ContactImportField, ImportEntityType, InquiryImportField, PropertyImportField } from "../types";

// Synonym dictionaries for auto-mapping headers
const CONTACT_HEADER_SYNONYMS: Record<ContactImportField, string[]> = {
  full_name: ["full name", "name", "пълно име", "имена", "три имена", "име и фамилия", "contact", "лице за контакт"],
  first_name: ["first name", "firstname", "first", "собствено име", "име"],
  last_name: ["last name", "lastname", "last", "surname", "фамилия", "презиме"],
  company_name: ["company", "company name", "organization", "business", "фирма", "компания", "организация", "юридическо лице"],
  contact_type: ["type", "contact type", "тип", "вид", "тип контакт"],
  phone: ["phone", "phone number", "mobile", "gsm", "cell", "телефон", "тел", "мобилен", "телефонен номер"],
  phone_2: ["phone 2", "phone2", "mobile 2", "телефон 2", "тел 2", "допълнителен телефон"],
  email: ["email", "e-mail", "mail", "имейл", "е-поща", "поща", "електронна поща"],
  email_2: ["email 2", "e-mail 2", "имейл 2", "е-поща 2"],
  viber: ["viber", "вайбър"],
  whatsapp: ["whatsapp", "whatsap", "уотсап", "уатсап"],
  note: ["note", "notes", "comment", "comments", "description", "бележка", "бележки", "коментар", "описание"],
  external_ref: ["id", "identifier", "ref", "reference", "external id", "номер", "ид", "референция", "външен номер"]
};

const INQUIRY_HEADER_SYNONYMS: Record<InquiryImportField, string[]> = {
  caller_name: ["caller name", "name", "име", "име на обаждащ се", "клиент"],
  caller_phone: ["caller phone", "phone", "телефон", "мобилен", "тел", "gsm"],
  caller_email: ["caller email", "email", "имейл", "е-поща"],
  subject: ["subject", "тема", "заглавие", "относно"],
  description: ["description", "описание", "детайли", "запитване", "note", "бележка"],
  source: ["source", "източник", "портал", "сайт"],
  external_ref: ["external ref", "ref", "id", "reference", "външен номер", "референция"],
  received_at: ["date received", "received at", "date", "дата", "дата на получаване", "получено на"],
  assigned_to: ["assigned to", "broker", "брокер", "отговорник", "агент"],
  status: ["status", "статус", "състояние"]
};

// Contacts and inquiries keep the merged dictionary they have always used (pinned in
// header-detection.test.ts); changing it would change their auto-mapping.
const LEGACY_HEADER_SYNONYMS = { ...CONTACT_HEADER_SYNONYMS, ...INQUIRY_HEADER_SYNONYMS };

// Property columns (spec: property-import, Columns). Exact matches come first; then a synonym
// longer than four letters also matches inside a header, but only when the header names one
// field, or when one matching synonym contains all the others ("година на строителство" over
// "строителство"). A header naming two fields ("Телефон на брокера", "Описание на квартала")
// is left for the user to map, never decided by the order below.
const PROPERTY_HEADER_SYNONYMS: Record<PropertyImportField, string[]> = {
  owner_phone: ["owner phone", "телефон", "тел", "телефон на собственика", "phone", "gsm", "мобилен"],
  owner_email: ["owner email", "email", "e-mail", "имейл", "е-поща", "имейл адрес", "имейл на собственика"],
  owner_name: ["owner", "owner name", "собственик", "продавач", "име на собственика"],
  external_ref: ["external ref", "external id", "ref", "id", "reference", "референция", "реф. номер", "референтен номер", "номер на имот", "код", "ид"],
  rent_price: ["rent price", "rent", "наем", "цена наем", "месечен наем"],
  sale_price: ["sale price", "price", "цена", "продажна цена", "цена продажба"],
  listing_status: ["listing status", "status", "статус", "състояние"],
  listed_at: ["listed at", "listed", "date", "дата", "дата на обява", "дата на публикуване"],
  assigned_to: ["assigned to", "broker", "agent", "брокер", "агент", "отговорник", "консултант"],
  plot_m2: ["plot m2", "plot area", "land area", "площ парцел", "площ на парцела", "дворно място", "двор"],
  area_m2: ["area m2", "size", "sqm", "m2", "м2", "кв.м", "квадратура", "площ", "застроена площ"],
  floors_total: ["floors total", "total floors", "етажност", "брой етажи", "етажи"],
  floor: ["floor", "етаж"],
  year_built: ["year built", "year", "година", "година на строителство", "построен"],
  construction: ["construction", "building type", "строителство", "конструкция", "тип строителство"],
  type: ["type", "property type", "тип", "вид", "тип имот", "вид имот"],
  rooms: ["rooms", "стаи", "брой стаи"],
  settlement: ["settlement", "city", "town", "населено място", "град", "град/село", "селище"],
  municipality: ["municipality", "община"],
  province: ["province", "region", "област"],
  area: ["area", "neighbourhood", "neighborhood", "район", "квартал", "кв.", "жк", "местност"],
  address: ["address", "street", "адрес", "улица"],
  location_note: ["location note", "location", "местоположение", "ориентир"],
  description: ["description", "notes", "note", "описание", "бележка", "бележки"],
};

const SYNONYMS_BY_ENTITY: Record<ImportEntityType, Record<string, string[]>> = {
  contact: LEGACY_HEADER_SYNONYMS,
  inquiry: LEGACY_HEADER_SYNONYMS,
  property: PROPERTY_HEADER_SYNONYMS,
};

// Remove accents/diacritics and normalize spacing/case
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9а-я]/g, " ") // replace non-alphanumeric (including cyrillic) with space
    .replace(/\s+/g, " ") // collapse multiple spaces
    .trim();
}

/**
 * Attempts to automatically map an array of raw CSV headers to known ImportField types.
 * Returns a mapping record where keys are Field strings and values are the exact original header strings.
 */
export function detectHeaders(headers: string[], entity: ImportEntityType): Record<string, string> {
  if (entity === "property") return detectPropertyHeaders(headers);
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  // Check each field type against its synonyms
  for (const [field, synonyms] of Object.entries(SYNONYMS_BY_ENTITY[entity])) {
    
    // Find the first header that matches a synonym for this field
    for (const originalHeader of headers) {
      if (usedHeaders.has(originalHeader)) continue;

      const normalized = normalizeHeader(originalHeader);
      
      // Exact match or partial match for longer synonyms
      const isMatch = (synonyms as string[]).some(synonym => {
        const normSynonym = normalizeHeader(synonym);
        return normalized === normSynonym || 
               (normSynonym.length > 4 && normalized.includes(normSynonym));
      });

      if (isMatch) {
        mapping[field] = originalHeader;
        usedHeaders.add(originalHeader);
        break; // Move to next field once we find a match
      }
    }
  }

  // Handle special case where 'име' might match both full_name and first_name.
  // We prioritize full_name in the dictionary iteration order, but if they have 
  // both 'first name' and 'last name', we shouldn't map 'full name'.
  // We'll trust the order of HEADER_SYNONYMS for now (full_name is checked first).

  return mapping;
}

/** The synonyms of each property field that a header contains (partial matches, over four letters). */
function partialMatches(header: string): { field: string; synonym: string }[] {
  const matches: { field: string; synonym: string }[] = [];
  for (const [field, synonyms] of Object.entries(PROPERTY_HEADER_SYNONYMS)) {
    for (const synonym of synonyms.map(normalizeHeader)) {
      if (synonym.length > 4 && header.includes(synonym)) matches.push({ field, synonym });
    }
  }
  return matches;
}

/** The one field a header names, or null when it names none or several (see PROPERTY_HEADER_SYNONYMS). */
function partialField(header: string): string | null {
  const matches = partialMatches(header);
  const fields = new Set(matches.map((m) => m.field));
  if (fields.size === 1) return matches[0].field;
  const covering = matches.find((m) => matches.every((other) => m.synonym.includes(other.synonym)));
  return covering?.field ?? null;
}

function detectPropertyHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  const fields = Object.entries(PROPERTY_HEADER_SYNONYMS);

  for (const [field, synonyms] of fields) {
    const wanted = new Set(synonyms.map(normalizeHeader));
    const header = headers.find((h) => !used.has(h) && wanted.has(normalizeHeader(h)));
    if (header) {
      mapping[field] = header;
      used.add(header);
    }
  }

  for (const [field] of fields) {
    if (mapping[field]) continue;
    const header = headers.find((h) => !used.has(h) && partialField(normalizeHeader(h)) === field);
    if (header) {
      mapping[field] = header;
      used.add(header);
    }
  }

  return mapping;
}
