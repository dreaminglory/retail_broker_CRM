/**
 * When a tapped Call, Viber or WhatsApp link turns into a "Did you reach them?" prompt (spec
 * phone-loop rule 3, assumption A1). One place, so the pilot can tune them.
 */
export const CALL_INTENT = {
  /** The page must be hidden at least this long for the return to count as a call. */
  minHiddenMs: 5_000,
  /** A tap older than this is forgotten. */
  maxAgeMs: 2 * 60 * 60 * 1_000,
  /** If the page doesn't hide within this, the desktop toast shows instead. */
  hideWithinMs: 3_000,
  /** How long the desktop toast stays. */
  toastMs: 2 * 60 * 1_000,
  /** The `sessionStorage` key; the value holds ids and a display name, never a number. */
  storageKey: 'brokercrm.call-intent',
} as const;
