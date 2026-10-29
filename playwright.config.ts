import { defineConfig, devices } from '@playwright/test';
import type { AppLocale } from './e2e/fixtures';

// E2E smoke tests against `npm run dev` and the local Supabase stack (AD-043).
// Run `npm run stack:up` first; `npx supabase db reset` gives a clean seed.
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };
const mobile = { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true };

export default defineConfig<{ appLocale: AppLocale }>({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // The specs share the seeded agency, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'bg-desktop', use: { ...desktop, appLocale: 'bg' } },
    { name: 'en-desktop', use: { ...desktop, appLocale: 'en' } },
    { name: 'bg-mobile', use: { ...mobile, appLocale: 'bg' } },
    { name: 'en-mobile', use: { ...mobile, appLocale: 'en' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
