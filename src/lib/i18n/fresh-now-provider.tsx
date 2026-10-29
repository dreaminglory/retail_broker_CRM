"use client";

/**
 * Gives a page its own next-intl `now` (the server's render time) without
 * re-sending messages: unset messages, formats and timeZone are inherited
 * from the root provider. The root layout's `now` survives soft navigations,
 * so relative times would otherwise start from the first page load.
 */

import { useMemo } from "react";
import { NextIntlClientProvider, useLocale } from "next-intl";

export function FreshNowProvider({ now, children }: { now: string; children: React.ReactNode }) {
  const locale = useLocale();
  const date = useMemo(() => new Date(now), [now]);
  return (
    <NextIntlClientProvider locale={locale} now={date}>
      {children}
    </NextIntlClientProvider>
  );
}
