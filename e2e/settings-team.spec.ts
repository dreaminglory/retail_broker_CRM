import { test, expect } from './fixtures';

test('each item in the member menu shows one icon', async ({ page, m, signInAs }) => {
  await signInAs('owner@alpha.bg');
  await page.goto('/settings/team');

  await page.getByRole('button', { name: m.SettingsTeam.actions.openMenu }).first().click();

  const items = page.getByRole('menuitem');
  await expect(items.first()).toBeVisible();
  for (const item of await items.all()) {
    await expect(item.locator('svg')).toHaveCount(1);
  }
});
