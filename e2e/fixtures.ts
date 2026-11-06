import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import bg from '../messages/bg.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };

export type AppLocale = 'bg' | 'en';
export type Messages = typeof en;

const MESSAGES: Record<AppLocale, Messages> = { bg: bg as Messages, en };

/** Seeded logins (supabase/seed.sql). */
export const SEEDED_PASSWORD = 'password123';

type Fixtures = {
  appLocale: AppLocale;
  /** The UI strings for this project's locale, so selectors work in bg and en. */
  m: Messages;
  signInAs: (email: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  appLocale: ['bg', { option: true }],
  m: async ({ appLocale }, provide) => {
    await provide(MESSAGES[appLocale]);
  },
  signInAs: async ({ page, appLocale }, provide) => {
    // Fixture callback named `provide`, not `use`, so the React hooks lint rule ignores it.
    await provide(async (email: string) => {
      // The login form renders in the cookie's locale (Bulgarian by default).
      await page.context().addCookies([{ name: 'NEXT_LOCALE', value: appLocale, url: 'http://localhost:3000' }]);
      await signIn(page, MESSAGES[appLocale], email);
      // Signing in syncs NEXT_LOCALE from profiles.locale; pin the project's locale again.
      await page.context().addCookies([{ name: 'NEXT_LOCALE', value: appLocale, url: 'http://localhost:3000' }]);
    });
  },
});

async function signIn(page: Page, m: Messages, email: string) {
  await page.goto('/login');
  await page.getByLabel(m.auth.login.email).fill(email);
  await page.getByLabel(m.auth.login.password).fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: m.auth.login.submit }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** A `datetime-local` value `days` from now at `hour`:00, in the browser's clock. */
export function dateTimeLocal(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/**
 * Makes a pending invitation look sent a day ago, so it can be resent now. The 5-minute cooldown
 * has no other way around it, and a fresh invitation always starts inside it. Local stack only:
 * it uses the service role key from .env.local.
 */
export async function backdateInvitation(email: string): Promise<void> {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])
  );
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agency_memberships?invitation_email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitation_sent_at: new Date(Date.now() - 24 * 3_600_000).toISOString() }),
  });
  if (!response.ok) throw new Error(`Could not backdate the invitation: ${response.status}`);
}

export { expect };
