import { ContactImportField, InquiryImportField } from "../types";

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

const HEADER_SYNONYMS = { ...CONTACT_HEADER_SYNONYMS, ...INQUIRY_HEADER_SYNONYMS };

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
export function detectHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  // Check each field type against its synonyms
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    
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
