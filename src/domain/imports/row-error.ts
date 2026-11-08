import type { ImportError } from "./types";

/**
 * One row error as the preview and the error CSV write it: the translated reason, plus its
 * `detail` (such as an ambiguous settlement's municipalities). A database error's detail is the
 * raw Postgres message, kept for support but never shown.
 */
export function describeRowError(error: ImportError, reason: (code: string) => string): string {
  const text = reason(error.code);
  return error.detail && error.code !== "import.errors.dbWrite" ? `${text} (${error.detail})` : text;
}
