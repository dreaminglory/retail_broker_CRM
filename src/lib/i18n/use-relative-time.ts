"use client";

import { useFormatter, useNow } from "next-intl";
import { relativeTimeBase } from "@/lib/time/relative-time";

/**
 * "8 seconds ago", measured from next-intl's `now` rather than the clock at render time, so
 * the server render and the browser's hydration agree. The page gives that `now` with
 * `FreshNowProvider` (its server render time); it then ticks every minute in the browser.
 */
export function useRelativeTime(): (date: Date | string) => string {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (value) => {
    const date = typeof value === "string" ? new Date(value) : value;
    return format.relativeTime(date, relativeTimeBase(date, now));
  };
}
