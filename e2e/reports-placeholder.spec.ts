import { test, expect } from './fixtures';

// ui-bright T26, success criterion 11: /reports is a Скоро placeholder. The banner is shown, the
// sidebar entry carries the Скоро badge and every control on the page is disabled. Read-only.

test('reports shows the Скоро banner and disabled controls', async ({ page, m, signInAs }) => {
  await signInAs('manager@alpha.bg');
  await page.goto('/reports');

  await expect(page.getByRole('status').filter({ hasText: m.ComingSoon.banner })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: m.Reports.title })).toBeVisible();

  const main = page.locator('main');
  const buttons = main.getByRole('button');
  expect(await buttons.count()).toBeGreaterThan(5);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
});
