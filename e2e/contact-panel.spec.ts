import { test, expect } from './fixtures';

// ui-bright T13, success criterion 8: from 1024 px a contacts row selects the contact into
// `?id=` and its panel opens beside the list, and a refresh keeps it; on a phone a row opens
// the contact page. An unknown or another agency's id shows no panel. Read-only.

const BETA_CONTACT = '22222222-5555-5555-5555-555555555551'; // seeded, Beta agency

test('the contact panel follows ?id=; a phone opens the contact page', async ({ page, signInAs }, testInfo) => {
  const onPhone = testInfo.project.name.endsWith('mobile');
  const rows = page.getByTestId('contact-row');
  const panel = page.getByTestId('contact-panel');

  await signInAs('broker@alpha.bg');
  await page.goto('/contacts');
  await expect(panel).toHaveCount(0);

  const row = rows.first();
  const name = (await row.locator('.text-body-strong').first().innerText()).trim();
  await row.click();

  if (onPhone) {
    // No room for the panel: the row opens the full page.
    await page.waitForURL(/\/contacts\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/contacts\?(.*&)?id=[0-9a-f-]{36}/);
    await expect(panel.getByRole('heading', { name })).toBeVisible();
    await expect(page.locator('[data-testid="contact-row"][aria-current="true"]')).toHaveCount(1);
    await page.reload();
    await expect(panel.getByRole('heading', { name })).toBeVisible();
    // The full contact page stays one click away.
    await panel.getByRole('link', { name, exact: true }).click();
    await page.waitForURL(/\/contacts\/[0-9a-f-]{36}$/);
  }

  // Unknown, malformed or another agency's id: the list, no panel.
  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid', BETA_CONTACT]) {
    await page.goto(`/contacts?id=${id}`);
    await expect(rows.first()).toBeVisible();
    await expect(panel).toHaveCount(0);
  }
});
