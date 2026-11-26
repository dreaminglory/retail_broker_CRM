import { test, expect } from './fixtures';

// ui-bright T10, success criterion 9: the deal page's tabs Път / Имоти / Изисквания / История
// open by click, by keyboard and by URL (`?tab=`); Път is the default and an unknown tab falls
// back to it. Read-only: nothing is written, so it runs against the seed as is.

const BUYER_DEAL = '/opportunities/11111111-6666-6666-6666-666666666661'; // seeded "Alpha Opp 1"

test('deal tabs open by click, keyboard and URL', async ({ page, m, signInAs }) => {
  const tablist = page.getByRole('tablist', { name: m.OpportunityDetail.tabs.label });
  const tab = (name: string) => tablist.getByRole('tab', { name: new RegExp(`^${name}`) });
  const path = tab(m.OpportunityDetail.tabs.path);
  const properties = tab(m.PropertyLinks.title);
  const requirements = tab(m.RequirementSection.title);
  const history = tab(m.OpportunityDetail.activityHistoryTitle);

  await signInAs('broker@alpha.bg');

  // Default: Път, with the next steps.
  await page.goto(BUYER_DEAL);
  await expect(path).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: m.OpportunityTaskList.addBtn })).toBeVisible();

  // Click: История shows the timeline and puts the tab in the URL (replace, not a new entry).
  await history.click();
  await expect(history).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]tab=history/);
  await expect(page.getByTestId('timeline-entry').first()).toBeVisible();
  await expect(page.getByRole('button', { name: m.OpportunityTaskList.addBtn })).toHaveCount(0);

  // Keyboard: arrows move and select; Home goes back to Път, which drops the param.
  await history.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(requirements).toBeFocused();
  await expect(requirements).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('section[aria-labelledby="opportunity-requirement"]')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(properties).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(path).toBeFocused();
  await expect(path).toHaveAttribute('aria-selected', 'true');
  await expect(page).not.toHaveURL(/tab=/);
  // Only the selected tab is in the Tab order.
  await expect(path).toHaveAttribute('tabindex', '0');
  await expect(history).toHaveAttribute('tabindex', '-1');

  // URL: a shared link opens its tab; a refresh keeps it.
  await page.goto(`${BUYER_DEAL}?tab=properties`);
  await expect(properties).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('section[aria-labelledby="opportunity-properties"]')).toBeVisible();
  await page.reload();
  await expect(properties).toHaveAttribute('aria-selected', 'true');

  // An unknown tab falls back to Път.
  await page.goto(`${BUYER_DEAL}?tab=istoriya`);
  await expect(path).toHaveAttribute('aria-selected', 'true');
});
