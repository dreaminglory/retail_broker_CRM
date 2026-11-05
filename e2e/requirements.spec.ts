import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// requirements AC-1, AC-2, AC-8: the requirement loop end to end, as a broker, in each
// project's locale and viewport. Add a requirement (two Sofia areas, a budget, a type) to the
// seeded buyer deal without one → edit its budget → the summary shows it → one timeline entry
// with the change and its old value → remove it, so the seed's empty state is back.

const BUYER_DEAL = '/opportunities/11111111-6666-6666-6666-666666666663'; // seeded "Alpha Opp 3", no requirement
const BUDGET_MIN = 150000;
const BUDGET_MAX = 200000;

/** Digits of `value` with any group separator between them: "€213,400", "213 400 €". */
const amount = (value: number) =>
  new RegExp(
    String(value)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
      .split(' ')
      .join('[\\s.,\\u00a0\\u202f]?'),
  );

const requirementSection = (page: Page) => page.locator('section[aria-labelledby="opportunity-requirement"]');

// `next dev`'s indicator sits over the sheet's sticky Save button; it isn't in a production build.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'nextjs-portal { display: none !important; }';
      document.head.append(style);
    });
  });
});

test('a broker records, edits and removes a buyer requirement', async ({ page, m, signInAs }) => {
  // A budget max of its own per run, so the timeline check finds this run's entry only: the
  // seed isn't reset between runs, so earlier runs' entries stay on the deal's timeline.
  const newMax = BUDGET_MAX + 1 + (Date.now() % 1_000_000);
  const section = requirementSection(page);

  await signInAs('broker@alpha.bg');
  await page.goto(BUYER_DEAL);

  // A run that failed half way may have left its requirement: remove it first. Wait for the
  // section to show either state, since isVisible() doesn't wait.
  const leftover = section.getByRole('button', { name: m.RequirementSection.remove });
  await expect(section.getByText(m.RequirementSection.empty).or(leftover)).toBeVisible();
  if (await leftover.isVisible()) {
    await leftover.click();
    await page.getByRole('alertdialog').getByRole('button', { name: m.RequirementSection.remove }).click();
  }
  await expect(section.getByText(m.RequirementSection.empty)).toBeVisible();

  // 1. Add: €150,000–€200,000, Лозенец and Младост 1 in Sofia, an apartment.
  await section.getByRole('button', { name: m.RequirementSection.add }).click();
  const form = page.getByRole('dialog', { name: m.RequirementForm.addTitle });
  const budget = form.getByRole('group', { name: m.RequirementForm.budgetPrice });
  await budget.getByLabel(m.RequirementForm.from).fill(String(BUDGET_MIN));
  await budget.getByLabel(m.RequirementForm.to).fill(String(BUDGET_MAX));
  await form.getByRole('combobox', { name: m.RequirementLocationPicker.settlement }).fill('Соф');
  await page.getByRole('option').first().click();
  await form.getByRole('button', { name: 'Лозенец', exact: true }).click();
  await form.getByRole('button', { name: 'Младост 1', exact: true }).click();
  await form.getByRole('button', { name: m.Enums.propertyType.apartment, exact: true }).click();
  // Budget, location and type turn on as must-haves when filled (rule 4).
  await expect(form.getByRole('switch', { name: m.RequirementForm.mustHaveOf.replace('{criterion}', m.RequirementForm.types) })).toBeChecked();
  await form.getByRole('button', { name: m.RequirementForm.save }).click();
  await expect(form).toBeHidden();

  const summary = section.getByTestId('requirement-summary');
  await expect(summary).toContainText('Лозенец');
  await expect(summary).toContainText('Младост 1');
  await expect(summary).toContainText(amount(BUDGET_MAX));
  await expect(section.getByText(m.RequirementSection.mustHave, { exact: true })).toHaveCount(3);

  // 2. Edit the budget max; the rest is kept.
  await section.getByRole('button', { name: m.RequirementSection.edit }).click();
  const editForm = page.getByRole('dialog', { name: m.RequirementForm.editTitle });
  await editForm.getByRole('group', { name: m.RequirementForm.budgetPrice }).getByLabel(m.RequirementForm.to).fill(String(newMax));
  await editForm.getByRole('button', { name: m.RequirementForm.save }).click();
  await expect(editForm).toBeHidden();
  await expect(summary).toContainText(amount(newMax));
  await expect(summary).toContainText('Младост 1');

  // 3. Switching the deal to tenant says the budget is now read as rent (rule 1); not saved.
  await page.getByRole('button', { name: m.OpportunityDetail.editBtn, exact: true }).first().click();
  const dealForm = page.getByRole('dialog', { name: m.OpportunityDetail.editTitle });
  await expect(dealForm.getByText(m.OpportunityForm.budgetNoticeRent)).toHaveCount(0);
  await dealForm.getByRole('combobox', { name: m.OpportunityForm.typeLabel }).click();
  await page.getByRole('option', { name: m.Enums.opportunityType.tenant, exact: true }).click();
  await expect(dealForm.getByRole('status').filter({ hasText: m.OpportunityForm.budgetNoticeRent })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dealForm).toBeHidden();

  // 4. One timeline entry for the edit, with the old and the new value.
  await page.reload();
  const edits = page
    .getByTestId('timeline-entry')
    .filter({ hasText: m.Timeline.events.requirementChanged })
    .filter({ hasText: amount(newMax) });
  await expect(edits).toHaveCount(1);
  await expect(edits).toContainText(m.Timeline.requirement.fields.budget_max);
  await expect(edits).toContainText(amount(BUDGET_MAX));
  await expect(edits).not.toContainText(m.Timeline.requirement.fields.locations);

  // 5. The summary line on the opportunities list (searched, so other specs' deals don't page it out).
  await page.goto('/opportunities?search=Alpha%20Opp%203');
  const row = page.getByRole('link', { name: /Alpha Opp 3/ });
  await expect(row).toContainText('Младост 1');
  await expect(row).toContainText(amount(newMax));
  await page.goto(BUYER_DEAL);

  // 6. Remove it: the empty state is back for the next run.
  await section.getByRole('button', { name: m.RequirementSection.remove }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: m.RequirementSection.remove }).click();
  await expect(confirm).toBeHidden();
  await expect(section.getByText(m.RequirementSection.empty)).toBeVisible();
});
