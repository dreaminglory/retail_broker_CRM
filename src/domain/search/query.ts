import { normalizePhone } from '../contacts/phone';

// Starts like a phone number and holds nothing else, so a bare number such as a year stays a word.
const LOOKS_LIKE_PHONE = /^(?:\+|0|359)[\d\s\-.() ]+$/;

/** Phones are stored E.164, so a whole phone number in the query is searched in that form. */
export function normalizeSearchQuery(query: string): string {
  if (!LOOKS_LIKE_PHONE.test(query)) return query;
  return normalizePhone(query) ?? query;
}
