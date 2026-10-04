/**
 * Phone number normalization utilities.
 * AD-012: E.164 enforcement adopted in Sprint 1 (reverses AD-010).
 *
 * Accepts any common Bulgarian format and normalizes to E.164 (+359XXXXXXXXX).
 *
 * Accepted inputs (spaces, dashes, dots, parens all stripped first):
 *   0888123456      → +359888123456   (10-digit local, leading 0)
 *   0888 123 456    → +359888123456
 *   088-812-3456    → +359888123456
 *   +359888123456   → +359888123456   (already E.164)
 *   359888123456    → +359888123456   (missing the +)
 *
 * Bulgarian numbers:
 *   - Mobile: 087/088/089 (A1), 098/099 (Vivacom), 085/086 (Yettel)
 *   - Fixed:  02 (Sofia), 032 (Plovdiv), 052 (Varna), etc.
 *   - After country code, always 9 digits → +359 + 9 digits = 13 chars total.
 */

/** Strip all whitespace, dashes, dots, and parentheses. */
function stripFormatting(raw: string): string {
  return raw.replace(/[\s\-.()\u00A0]/g, '');
}

/**
 * Normalizes a raw phone string to E.164 (+359XXXXXXXXX).
 * Returns null if the input cannot be normalized.
 */
export function normalizePhone(raw: string): string | null {
  const stripped = stripFormatting(raw);

  let digits: string;

  if (stripped.startsWith('+359')) {
    digits = stripped.slice(1); // drop the '+', keep '359...'
  } else if (stripped.startsWith('359')) {
    digits = stripped;
  } else if (stripped.startsWith('0')) {
    // Local format: replace leading 0 with 359
    digits = '359' + stripped.slice(1);
  } else {
    return null; // unrecognizable prefix
  }

  // After normalization digits should be '359' + 9 digits = 12 digits
  if (!/^359\d{9}$/.test(digits)) {
    return null;
  }

  return '+' + digits;
}

/**
 * Returns a user-friendly validation error message for an invalid phone.
 */
export function phoneValidationMessage(): string {
  return (
    'Enter a valid Bulgarian phone number ' +
    '(e.g. 0888 123 456 or +359 888 123 456)'
  );
}
