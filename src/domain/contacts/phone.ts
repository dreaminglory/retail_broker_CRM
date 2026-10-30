/**
 * Phone number normalization utilities.
 * AD-012: E.164 enforcement adopted in Sprint 1 (reverses AD-010).
 * AD-041: parsing by libphonenumber-js (min metadata) with BG as the default region.
 *
 * Accepted inputs:
 *   0888 123 456      → +359888123456   (BG mobile, local format)
 *   02 987 6543       → +35929876543    (BG landline)
 *   359888123456      → +359888123456   (missing the +)
 *   +44 7700 900123   → +447700900123   (foreign, with country code)
 *   00447700900123    → +447700900123   (foreign, international prefix)
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Normalizes a raw phone string to E.164.
 * Returns null if the input cannot be normalized.
 */
export function normalizePhone(raw: string): string | null {
  // extract: false rejects a number buried in other text instead of pulling it out.
  const parsed = parsePhoneNumberFromString(raw, { defaultCountry: 'BG', extract: false });

  if (!parsed) return null;

  // Foreign numbers only need a possible length: min metadata lags new ranges abroad,
  // and rejecting a real caller costs more than storing a typo. BG numbers are checked fully.
  const accepted = parsed.countryCallingCode === '359' ? parsed.isValid() : parsed.isPossible();

  return accepted ? parsed.number : null;
}

/**
 * Returns a user-friendly validation error message for an invalid phone.
 */
export function phoneValidationMessage(): string {
  return (
    'validation.invalid_phone'
  );
}
