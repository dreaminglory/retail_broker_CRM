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

// ui-bright T27: /settings/rules and /settings/portals are Скоро placeholders, owner/manager only.
for (const [path, titleKey] of [
  ['/settings/rules', 'SettingsRules'],
  ['/settings/portals', 'SettingsPortals'],
] as const) {
  test(`${path} shows the Скоро banner and disabled controls`, async ({ page, m, signInAs }) => {
    await signInAs('manager@alpha.bg');
    await page.goto(path);

    await expect(page.getByRole('status').filter({ hasText: m.ComingSoon.banner })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: m[titleKey].title })).toBeVisible();
    const controls = page.locator('main').locator('button, input');
    expect(await controls.count()).toBeGreaterThan(3);
    for (const control of await controls.all()) await expect(control).toBeDisabled();
  });

  test(`${path} sends a broker back to Settings`, async ({ page, signInAs }) => {
    await signInAs('broker@alpha.bg');
    await page.goto(path);
    await expect(page).toHaveURL(/\/settings$/);
  });
}
