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
