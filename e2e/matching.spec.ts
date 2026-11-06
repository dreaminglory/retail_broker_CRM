import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// matching AC-1, AC-3, AC-4: the deal-side match loop end to end, as a broker, in each project's
// locale and viewport. The seeded buyer deal lists its best match first → "Add as candidate" →
// the property leaves the new matches and shows under Properties as a candidate → the "Show
// already offered" toggle lists it with that status → the link is removed again, so a rerun
// starts from the same seed.

const BUYER_DEAL = '/opportunities/11111111-6666-6666-6666-666666666661'; // seeded "Alpha Opp 1"
const BEST_MATCH = '#1009'; // 2-room Лозенец apartment at €185,000, 100%, never linked in the seed

const matchesSection = (page: Page) => page.locator('section[aria-labelledby="opportunity-matches-title"]');
const propertiesSection = (page: Page) => page.locator('section[aria-labelledby="opportunity-properties"]');

test('a broker adds the best match as a candidate and sees it under already offered', async ({ page, m, signInAs }) => {
  const matches = matchesSection(page);
  const properties = propertiesSection(page);
  const removeLink = m.PropertyLinks.removeLink.replace('{code}', BEST_MATCH);

  await signInAs('broker@alpha.bg');
  await page.goto(BUYER_DEAL);

  // A run that failed half way may have left the link: remove it first.
  await expect(matches).toBeVisible();
  const leftover = properties.getByRole('button', { name: removeLink });
  if (await leftover.isVisible()) {
    await leftover.click();
    await expect(leftover).toBeHidden();
  }

  // 1. The best match is first, 100%, with every chip positive and the must-haves marked.
  const rows = matches.getByTestId('match-row');
  const best = rows.first();
  await expect(best).toContainText(BEST_MATCH);
  await expect(best).toContainText(m.matching.score.replace('{score}', '100'));
  await expect(best).toContainText(m.matching.result.match);
  await expect(best).not.toContainText(m.matching.result.miss);
  await expect(best).toContainText(m.matching.mustHave);
  const newBefore = await rows.count();

  // 2. Add it as a candidate: it leaves the new matches and shows under Properties.
  await best.getByRole('button', { name: m.matching.addCandidateFor.replace('{code}', BEST_MATCH) }).click();
  await expect(rows.filter({ hasText: BEST_MATCH })).toHaveCount(0);
  await expect(rows).toHaveCount(newBefore - 1);
  await expect(properties.getByRole('button', { name: removeLink })).toBeVisible();
  await expect(properties.getByRole('combobox', { name: m.PropertyLinks.statusOf.replace('{code}', BEST_MATCH) })).toContainText(
    m.Enums.propertyLinkStatus.candidate,
  );
  // The link says where it came from.
  await expect(properties.getByText(m.Enums.propertyLinkSource.match)).toBeVisible();

  // 3. "Show already offered" lists it with its status.
  await matches.getByRole('link', { name: m.matching.showLinked }).click();
  await expect(page).toHaveURL(/matchesLinked=1/);
  const linked = rows.filter({ hasText: BEST_MATCH });
  await expect(linked).toHaveCount(1);
  await expect(linked).toContainText(m.Enums.propertyLinkStatus.candidate);
  await expect(linked.getByRole('button', { name: m.matching.addCandidateFor.replace('{code}', BEST_MATCH) })).toHaveCount(0);

  // 4. Clean up: remove the link, so the seed's matches are back.
  await properties.getByRole('button', { name: removeLink }).click();
  await expect(properties.getByRole('button', { name: removeLink })).toBeHidden();
  await matches.getByRole('link', { name: m.matching.hideLinked }).click();
  await expect(rows.filter({ hasText: BEST_MATCH })).toHaveCount(1);
});

// matching AC-5: the property side. The €185,000 apartment lists the seeded buyer deal with its
// broker → "Add to this deal" links it as a candidate → the deal leaves the new matches and the
// toggle shows it with that status → the link is removed again.
const BEST_PROPERTY = '/properties/11111111-9999-0000-0000-000000000011'; // #1009
const DEAL_TITLE = 'Alpha Opp 1';

const dealMatches = (page: Page) => page.locator('section[aria-labelledby="property-matches-title"]');

test('a broker adds a matching buyer deal from the property page', async ({ page, m, signInAs }) => {
  const matches = dealMatches(page);
  const rows = matches.getByTestId('match-row');
  const removeLink = m.PropertyLinks.removeLink.replace('{code}', BEST_MATCH);

  await signInAs('broker@alpha.bg');

  // A run that failed half way may have left the link: remove it from the deal first.
  await page.goto(BUYER_DEAL);
  const leftover = propertiesSection(page).getByRole('button', { name: removeLink });
  await expect(matchesSection(page)).toBeVisible();
  if (await leftover.isVisible()) {
    await leftover.click();
    await expect(leftover).toBeHidden();
  }

  // 1. The buyer deal is listed with its contact and broker, and 100%.
  await page.goto(BEST_PROPERTY);
  await expect(matches.getByRole('heading', { name: m.matching.dealsTitleSale })).toBeVisible();
  const row = rows.filter({ hasText: DEAL_TITLE });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Ivan Ivanov');
  await expect(row).toContainText(m.matching.broker.replace('{name}', ''));
  await expect(row).toContainText(m.matching.score.replace('{score}', '100'));
  // Seller deals are not matches: every row is a buyer deal, so none shows a type label.
  await expect(matches.getByText(m.Enums.opportunityType.seller, { exact: true })).toHaveCount(0);

  // 2. Add it to the deal: it leaves the new matches.
  await row.getByRole('button', { name: m.matching.addToDealFor.replace('{title}', DEAL_TITLE) }).click();
  await expect(rows.filter({ hasText: DEAL_TITLE })).toHaveCount(0);

  // 3. The toggle shows it with its status.
  await matches.getByRole('link', { name: m.matching.showLinked }).click();
  await expect(page).toHaveURL(/dealMatchesLinked=1/);
  const linked = rows.filter({ hasText: DEAL_TITLE });
  await expect(linked).toHaveCount(1);
  await expect(linked).toContainText(m.Enums.propertyLinkStatus.candidate);

  // The property's linked deals mark the link too.
  await expect(page.locator('section[aria-labelledby="property-opportunities"]').getByText(m.Enums.propertyLinkSource.match)).toBeVisible();

  // 4. Clean up from the deal's Properties section.
  await page.goto(BUYER_DEAL);
  await propertiesSection(page).getByRole('button', { name: removeLink }).click();
  await expect(propertiesSection(page).getByRole('button', { name: removeLink })).toBeHidden();
});

// matching, "Not suitable": the best match is marked with a reason → it leaves the new matches,
// the toggle shows it as rejected and the deal's Properties section shows the reason → the link
// is removed again.
test('a broker marks a match as not suitable with a reason', async ({ page, m, signInAs }) => {
  const matches = matchesSection(page);
  const properties = propertiesSection(page);
  const rows = matches.getByTestId('match-row');
  const removeLink = m.PropertyLinks.removeLink.replace('{code}', BEST_MATCH);
  const reason = `Too noisy ${Date.now()}`;

  await signInAs('broker@alpha.bg');
  await page.goto(BUYER_DEAL);
  await expect(matches).toBeVisible();
  const leftover = properties.getByRole('button', { name: removeLink });
  if (await leftover.isVisible()) {
    await leftover.click();
    await expect(leftover).toBeHidden();
  }

  const best = rows.first();
  await expect(best).toContainText(BEST_MATCH);
  const newBefore = await rows.count();
  await best.getByRole('button', { name: m.matching.notSuitableFor.replace('{code}', BEST_MATCH) }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(m.PropertyLinks.rejectReason).fill(reason);
  await dialog.getByRole('button', { name: m.PropertyLinks.reject, exact: true }).click();
  await expect(dialog).toBeHidden();

  // It leaves the new matches and shows under Properties as rejected, with the reason and marker.
  await expect(rows).toHaveCount(newBefore - 1);
  await expect(properties.getByText(m.PropertyLinks.rejectedBecause.replace('{reason}', reason))).toBeVisible();
  await expect(properties.getByText(m.Enums.propertyLinkSource.match)).toBeVisible();

  // The toggle shows it as rejected, without the actions.
  await matches.getByRole('link', { name: m.matching.showLinked }).click();
  const linked = rows.filter({ hasText: BEST_MATCH });
  await expect(linked).toContainText(m.Enums.propertyLinkStatus.rejected);
  await expect(linked.getByRole('button')).toHaveCount(0);

  await properties.getByRole('button', { name: removeLink }).click();
  await expect(properties.getByRole('button', { name: removeLink })).toBeHidden();
});
