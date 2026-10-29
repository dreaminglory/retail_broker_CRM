import { z } from 'zod';

/**
 * Value a select submits for "no selection" (e.g. BrokerSelect's "Unassigned").
 * Radix-style selects can't use an empty string as an item value, so forms use
 * this sentinel and the schemas map it back to null.
 */
export const NONE_SELECT_VALUE = 'none';

/**
 * Optional, nullable uuid reference that accepts form input: the
 * `NONE_SELECT_VALUE` sentinel and the empty string both parse to null.
 */
export function nullableUuid() {
  return z
    .preprocess(
      (value) => (value === '' || value === NONE_SELECT_VALUE ? null : value),
      z.string().uuid().nullable(),
    )
    .optional();
}
