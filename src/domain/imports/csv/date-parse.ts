import { TZDate } from "@date-fns/tz";
import { parse, isValid, isAfter, addDays } from "date-fns";

/**
 * Parses a date string in various Bulgarian or ISO formats.
 * Interprets the wall-clock time in the given timezone (default Europe/Sofia).
 * Rejects dates that are strictly more than 1 day in the future.
 * `format` (a job's date format) replaces the day-first guesses: only it and the ISO forms
 * are tried, so `03/05/2025` is never read the other way round.
 */
export function parseDate(
  value: string | null | undefined,
  tz: string = "Europe/Sofia",
  format?: string
): Date | null {
  if (!value || !value.trim()) return null;

  const trimmed = value.trim();
  const iso = ["yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm"];
  const formats = format ? [format, ...iso.filter((f) => f !== format)] : [
    "dd.MM.yyyy HH:mm:ss",
    "dd.MM.yyyy HH:mm",
    "dd.MM.yyyy",
    "yyyy-MM-dd",
    "dd/MM/yyyy HH:mm:ss",
    "dd/MM/yyyy HH:mm",
    "dd/MM/yyyy",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
  ];

  let parsedDate: Date | null = null;
  
  // Try native parse first (handles ISO 8601)
  const nativeDate = new Date(trimmed);
  if (isValid(nativeDate) && trimmed.includes("T")) {
    parsedDate = nativeDate;
  } else {
    for (const formatStr of formats) {
      const referenceDate = new TZDate(new Date(), tz);
      const attempt = parse(trimmed, formatStr, referenceDate);
      if (isValid(attempt)) {
        parsedDate = new TZDate(attempt, tz);
        break;
      }
    }
  }

  if (!parsedDate || !isValid(parsedDate)) {
    return null;
  }

  // Reject future-beyond-1-day
  const tomorrow = addDays(new Date(), 1);
  if (isAfter(parsedDate, tomorrow)) {
    return null;
  }

  return parsedDate;
}
