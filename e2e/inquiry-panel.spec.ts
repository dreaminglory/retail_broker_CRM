import { test, expect } from './fixtures';

// ui-bright T12, success criterion 8: on the inquiries page a row selects the inquiry into
// `?id=` and its panel opens beside the list (≥ 1024 px) or instead of it (phone); a refresh
// keeps the selection; an unknown id or another agency's inquiry shows no panel. Read-only.

const BETA_INQUIRY = '22222222-7777-7777-7777-777777777771'; // seeded, Beta agency

test('the inquiry panel follows ?id= and survives a reload', async ({ page, m, signInAs }, testInfo) => {
  const onPhone = testInfo.project.name.endsWith('mobile');
  const rows = page.getByTestId('inquiry-row');
  const panel = page.getByTestId('inquiry-panel');

  await signInAs('broker@alpha.bg');
  await page.goto('/inquiries');
  await expect(panel).toHaveCount(0);

  // Select the second row: the URL takes its id and the panel shows that caller.
  const row = rows.nth(1);
  const caller = (await row.locator('.text-body-strong').first().innerText()).trim();
  await row.click();
  await expect(page).toHaveURL(/[?&]id=[0-9a-f-]{36}/);
  await expect(panel).toBeVisible();
  await expect(panel.getByText(caller, { exact: true }).first()).toBeVisible();
  // Beside the list on a desktop, instead of it on a phone.
  if (onPhone) await expect(rows.first()).toBeHidden();
  else await expect(page.locator('[data-testid="inquiry-row"][aria-current="true"]')).toHaveCount(1);

  // A refresh (or a shared link) keeps it.
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(panel.getByText(caller, { exact: true }).first()).toBeVisible();

  // On a phone the panel links back to the list.
  if (onPhone) {
    await panel.getByRole('link', { name: m.InquiriesPage.viewAllBtn }).click();
    await expect(page).not.toHaveURL(/[?&]id=/);
    await expect(rows.first()).toBeVisible();
  }

  // Unknown, malformed or another agency's id: the list, no panel.
  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid', BETA_INQUIRY]) {
    await page.goto(`/inquiries?id=${id}`);
    await expect(page.getByText(m.InquiriesPage.emptyState.notFoundTitle)).toBeVisible();
    await expect(panel).toHaveCount(0);
    await expect(rows.first()).toBeVisible();
  }
});
