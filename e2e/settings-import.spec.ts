import { readFileSync } from 'node:fs';
import { test, expect, formatMessage, serviceRest } from './fixtures';

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

// property-import Task 12 (AC-1, AC-5, AC-9): a manager imports the basic fixture, unticks the
// new area, commits, finds a property in the list and in ⌘K, then reverts the import.

const PROPERTIES_BASIC = readFileSync('src/domain/imports/__fixtures__/properties-basic.csv');
const ALPHA_AGENCY = '11111111-1111-1111-1111-111111111111'; // seeded "Alpha Imoti"

/** Deletes what an interrupted run left behind, so the next project starts from the seed. */
async function removeLeftoverPropertyImports() {
  const jobs = await serviceRest<{ id: string }[]>(
    'import_jobs?select=id&status=in.(completed,committing)&file_name=like.e2e-properties-*'
  );
  for (const { id } of jobs) {
    await serviceRest(`properties?import_job_id=eq.${id}`, { method: 'DELETE' });
    await serviceRest(`contacts?import_job_id=eq.${id}`, { method: 'DELETE' });
    await serviceRest(`areas?import_job_id=eq.${id}`, { method: 'DELETE' });
    await serviceRest(`import_jobs?id=eq.${id}`, { method: 'PATCH', body: { status: 'reverted' } });
  }
}

test('a manager imports properties, unticks a new area and reverts the import', async ({ page, m, appLocale, signInAs }, testInfo) => {
  await removeLeftoverPropertyImports();
  const fileName = `e2e-properties-${testInfo.project.name}-${Date.now()}.csv`;
  const preview = m.SettingsImport.propertyPreview;

  await signInAs('manager@alpha.bg');
  // The list shows no address; the basic file has one Кършияка property, so the list filtered to
  // that area (one short page, however many properties the agency has) gains one row.
  const [area] = await serviceRest<{ id: string; settlement_id: string }[]>(
    `areas?select=id,settlement_id&agency_id=eq.${ALPHA_AGENCY}&name=eq.${encodeURIComponent('Кършияка')}`
  );
  const karshiyakaList = `/properties?settlement=${area.settlement_id}&area=${area.id}`;
  const karshiyaka = page.getByText(/Кършияка/).locator('visible=true');
  await page.goto(karshiyakaList);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const karshiyakaBefore = await karshiyaka.count();

  await page.goto('/settings/import');
  await page.getByRole('button', { name: m.SettingsImport.newImport }).click();
  await page.getByRole('menuitem', { name: m.SettingsImport.importProperties }).click();
  await page.waitForURL('**/settings/import/new?type=property');

  // 1–2. Upload; every column maps by itself.
  await page.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: 'text/csv', buffer: PROPERTIES_BASIC });
  await expect(page.getByText(m.SettingsImport.wizard.step2.title)).toBeVisible();
  await page.getByRole('button', { name: m.SettingsImport.wizard.nextReview }).click();

  // 3. Preview: 20 new, one BGN price, four new owners, and the new area "Витоша" (3 rows).
  await expect(page.getByText(m.SettingsImport.wizard.step3.title)).toBeVisible();
  const tile = (label: string) => page.getByText(label, { exact: true }).first().locator('..');
  await expect(tile(preview.counts.new)).toContainText('20');
  await expect(tile(preview.counts.duplicate)).toContainText('0');
  await expect(tile(preview.counts.invalid)).toContainText('0');
  await expect(tile(preview.counts.skipped)).toContainText('0');
  await expect(page.getByText(formatMessage(appLocale, preview.owners, { matched: 0, created: 4 }))).toBeVisible();
  await expect(page.getByText(formatMessage(appLocale, preview.bgnConverted, { count: 1 }))).toBeVisible();
  const vitosha = page.getByRole('checkbox', { name: /Витоша/ });
  await expect(vitosha).toBeChecked();
  await expect(page.getByText(formatMessage(appLocale, preview.newAreas.rows, { count: 3 }))).toBeVisible();
  await vitosha.uncheck();

  // 4–5. Commit; the done step counts 20 and leads to the properties.
  await page.getByRole('button', { name: m.SettingsImport.wizard.startImport }).click();
  await expect(
    page.getByText(formatMessage(appLocale, m.SettingsImport.wizard.step5.result, { created: 20, skipped: 0, errors: 0 }))
  ).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: formatMessage(appLocale, m.SettingsImport.wizard.step5.goTo, { type: m.SettingsImport.wizard.propertiesType }) }).click();
  await page.waitForURL('**/properties');

  // ⌘K finds an imported property by its address.
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByPlaceholder(m.search.inputPlaceholder).fill('Фикция 20');
  await page.getByRole('option', { name: /Фикция 20/ }).click();
  await page.waitForURL(/\/properties\/[0-9a-f-]{36}$/);
  await expect(page.getByText('ул. Фикция 20').first()).toBeVisible();

  await page.goto(karshiyakaList);
  await expect(karshiyaka).toHaveCount(karshiyakaBefore + 1);

  // Revert: all 20 properties and 4 owners go; no area was created.
  await page.goto('/settings/import');
  await page.getByRole('row', { name: new RegExp(fileName) }).getByTitle(m.SettingsImport.revertImport).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(m.SettingsImport.revertDescProperty);
  await dialog.getByRole('button', { name: m.SettingsImport.revert, exact: true }).click();
  await expect(
    page.getByText(
      formatMessage(appLocale, m.SettingsImport.revertSuccessProperty, {
        properties: 20, contacts: 4, areas: 0, keptProperties: 0, keptContacts: 0, keptAreas: 0,
      })
    )
  ).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(fileName) })).toContainText(m.SettingsImport.jobStatus.reverted);
});

// Review fix: a commit batch that fails leaves the wizard on the importing step with a resume
// button, never on "Import Complete"; resuming finishes the job.
test('a property import that stops halfway can be resumed', async ({ page, m, appLocale, signInAs }, testInfo) => {
  await removeLeftoverPropertyImports();
  const fileName = `e2e-properties-resume-${testInfo.project.name}-${Date.now()}.csv`;

  await signInAs('manager@alpha.bg');
  await page.goto('/settings/import/new?type=property');
  await page.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: 'text/csv', buffer: PROPERTIES_BASIC });
  await page.getByRole('button', { name: m.SettingsImport.wizard.nextReview }).click();
  await expect(page.getByText(m.SettingsImport.wizard.step3.title)).toBeVisible();

  // After Start: the first Server Action saves the kept areas, the second is the first batch.
  let actions = 0;
  await page.route('**/settings/import/new**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action'] && ++actions === 2) return route.abort();
    return route.continue();
  });
  await page.getByRole('button', { name: m.SettingsImport.wizard.startImport }).click();

  await expect(page.getByText(m.SettingsImport.wizard.step4.stopped)).toBeVisible();
  await expect(page.getByText(m.SettingsImport.wizard.step5.title)).toBeHidden();
  await page.unrouteAll();

  await page.getByRole('button', { name: m.SettingsImport.wizard.step4.resume }).click();
  await expect(
    page.getByText(formatMessage(appLocale, m.SettingsImport.wizard.step5.result, { created: 20, skipped: 0, errors: 0 }))
  ).toBeVisible({ timeout: 60_000 });

  await removeLeftoverPropertyImports();
});
