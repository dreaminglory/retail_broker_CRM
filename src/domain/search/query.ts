import { normalizePhone } from '../contacts/phone';

// Starts like a phone number and holds nothing else, so a bare number such as a year stays a word.
const LOOKS_LIKE_PHONE = /^(?:\+|0|359)[\d\s\-.() ]+$/;

/** Phones are stored E.164, so a whole phone number in the query is searched in that form. */
export function normalizeSearchQuery(query: string): string {
  if (!LOOKS_LIKE_PHONE.test(query)) return query;
  return normalizePhone(query) ?? query;
}

/**
 * A `to_tsquery` text that needs every word as a prefix. A bare number also matches its "+"
 * form, so 359… finds +359…. Quotes and backslashes are escaped so any input parses. (A leading
 * "#" needs nothing: the 'simple' parser drops it, so "#1042" finds property 1042.)
 */
export function toPrefixQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/\\/g, '\\\\').replace(/'/g, "''"))
    .map((word) => (/^\d+$/.test(word) ? `('+${word}':* | '${word}':*)` : `'${word}':*`))
    .join(' & ');
}
