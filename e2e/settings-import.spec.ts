import { test, expect } from './fixtures';

// The "New import" menu hydrates cleanly and still leads to the import wizard. A Base UI
// `render` element sent from a Server Component reaches the client lazy, which breaks hydration.

test('the import page hydrates and the new import menu opens the wizard', async ({ page, m, signInAs }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await signInAs('owner@alpha.bg');
  consoleErrors.length = 0;

  await page.goto('/settings/import');
  await page.getByRole('button', { name: m.SettingsImport.newImport }).click();
  await page.getByRole('menuitem', { name: m.SettingsImport.importContacts }).click();
  await page.waitForURL('**/settings/import/new?type=contact');

  expect(consoleErrors.filter((text) => /hydrat/i.test(text))).toEqual([]);
});
