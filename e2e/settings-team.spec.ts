import { test, expect, backdateInvitation } from './fixtures';

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

// AC-8 (FR-TEM-07): a resend within 5 minutes of the last send is refused with the time it is allowed
// again; after that, an owner resends once and then has to wait. Each run invites its own address
// and cancels it at the end.
test('an owner resends a pending invitation once, then waits', async ({ page, m, signInAs }, testInfo) => {
  const email = `e2e-resend-${testInfo.project.name}-${Date.now()}@example.test`;
  await signInAs('owner@alpha.bg');
  await page.goto('/settings/team');

  await page.getByRole('button', { name: m.SettingsTeam.invite.button }).click();
  const inviteDialog = page.getByRole('dialog');
  await inviteDialog.getByLabel(m.SettingsTeam.invite.emailLabel).fill(email);
  await inviteDialog.getByRole('button', { name: m.SettingsTeam.invite.send }).click();
  await expect(inviteDialog).toBeHidden();

  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toContainText(m.SettingsTeam.resend.sentOn.split('{date}')[0].trim());

  // A new invitation was just sent, so a resend now waits.
  await row.getByRole('button', { name: m.SettingsTeam.resend.button }).click();
  await expect(page.getByText(m.errors.members.resend_too_soon.split('{time}')[0].trim())).toBeVisible();

  await backdateInvitation(email);
  await page.reload();
  await row.getByRole('button', { name: m.SettingsTeam.resend.button }).click();
  await expect(page.getByText(m.SettingsTeam.resend.sent)).toBeVisible();
  // The toast can cover the button on a phone; wait for it to go before the next click.
  await expect(page.getByText(m.SettingsTeam.resend.sent)).toBeHidden();

  await row.getByRole('button', { name: m.SettingsTeam.resend.button }).click();
  await expect(page.getByText(m.errors.members.resend_too_soon.split('{time}')[0].trim())).toBeVisible();

  // Clean up so reruns don't pile up pending members.
  await row.getByRole('button', { name: m.SettingsTeam.actions.openMenu }).click();
  await page.getByRole('menuitem', { name: m.SettingsTeam.actions.cancelInvitation }).click();
  await expect(row).toHaveCount(0);
});
