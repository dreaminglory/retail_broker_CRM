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

test('the wizard says so when a file cannot be read', async ({ page, m, signInAs }) => {
  await signInAs('owner@alpha.bg');
  await page.addInitScript(() => {
    File.prototype.arrayBuffer = () => Promise.reject(new Error('File moved after it was picked'));
  });
  await page.goto('/settings/import/new?type=inquiry');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'unreadable.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name\nx\n'),
  });

  await expect(page.getByText(m.SettingsImport.dropzone.parseFailed)).toBeVisible();
});

// "Брокер" (a header the wizard maps by itself) in each encoding a Bulgarian CSV arrives in.
const BROKER_HEADER = {
  'utf-8': Buffer.from('Брокер', 'utf-8'),
  'windows-1251': Buffer.from([0xc1, 0xf0, 0xee, 0xea, 0xe5, 0xf0]),
};

for (const [encoding, header] of Object.entries(BROKER_HEADER)) {
  test(`the wizard reads Cyrillic headers from a ${encoding} file`, async ({ page, signInAs }) => {
    await signInAs('owner@alpha.bg');
    await page.goto('/settings/import/new?type=inquiry');

    await page.locator('input[type="file"]').setInputFiles({
      name: `${encoding}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.concat([header, Buffer.from(',Phone\nx,+359888100001\n')]),
    });

    await expect(page.getByText('Брокер', { exact: true }).first()).toBeVisible();
  });
}
