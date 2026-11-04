import { test, expect, dateTimeLocal } from './fixtures';

// properties AC-8: the property loop end to end, as a broker, in each project's locale and
// viewport. New property → sale listing → owner → candidate on the seeded buyer deal →
// viewing scheduled from the property → completed on the deal → `viewed` on both pages.

const BUYER_DEAL = '/opportunities/11111111-6666-6666-6666-666666666661'; // seeded "Alpha Opp 1", a buyer deal
const ALPHA_PROPERTY = '/properties/11111111-9999-0000-0000-000000000001'; // seeded Alpha #1001

test('a broker lists a property, proposes it to a buyer and records the viewing', async ({ page, m, signInAs }, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now()}`;
  const address = `ул. E2E ${run}`;
  const viewing = `E2E viewing ${run}`;
  const followUp = `E2E follow-up ${run}`;

  await signInAs('broker@alpha.bg');

  // 1. Create the property (a two-room apartment in Sofia).
  await page.goto('/properties/new');
  await page.getByLabel(m.PropertyForm.rooms).fill('2');
  await page.getByRole('combobox', { name: m.PropertyForm.settlement }).fill('Соф');
  await page.getByRole('option').first().click();
  await page.getByLabel(m.PropertyForm.address).fill(address);
  await page.getByRole('button', { name: m.PropertyForm.create }).click();
  await page.waitForURL(/\/properties\/[0-9a-f-]{36}$/);
  const propertyUrl = page.url();
  const code = (await page.getByText(/^#\d+$/).first().textContent())!.trim();

  // 2. A sale listing.
  await page.getByRole('button', { name: m.ListingSection.addListing }).first().click();
  const listingDialog = page.getByRole('dialog');
  await listingDialog.getByLabel(m.ListingSection.priceEur).fill('185000');
  await listingDialog.getByRole('button', { name: m.ListingSection.addListing }).click();
  await expect(listingDialog).toBeHidden();

  // 3. An owner, from the seeded contacts.
  await page.getByRole('button', { name: m.PartySection.addParty }).first().click();
  const partyDialog = page.getByRole('dialog');
  await partyDialog.getByRole('combobox', { name: m.PartySection.contact }).fill('Alpha');
  await page.getByRole('option').first().click();
  await partyDialog.getByRole('button', { name: m.PartySection.addParty }).click();
  await expect(partyDialog).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(m.PartySection.end) })).toHaveCount(1);

  // 4. Propose it on the buyer deal.
  await page.goto(BUYER_DEAL);
  await page.getByRole('button', { name: m.PropertyLinks.addCandidate }).first().click();
  const candidateDialog = page.getByRole('dialog');
  await candidateDialog.getByRole('combobox', { name: m.PropertyLinks.property }).fill(address);
  await page.getByRole('option', { name: new RegExp(code) }).click();
  await candidateDialog.getByRole('button', { name: m.PropertyLinks.add }).click();
  await expect(candidateDialog).toBeHidden();
  const statusOnDeal = page.getByRole('combobox', { name: m.PropertyLinks.statusOf.replace('{code}', code) });
  await expect(statusOnDeal).toContainText(m.Enums.propertyLinkStatus.candidate);

  // 5. Schedule the viewing from the property page.
  await page.goto(propertyUrl);
  const deals = page.locator('section[aria-labelledby="property-opportunities"]');
  await expect(deals.getByText(m.Enums.propertyLinkStatus.candidate)).toBeVisible();
  await page.getByRole('button', { name: m.PropertyViewing.schedule }).click();
  const viewingDialog = page.getByRole('dialog');
  await viewingDialog.getByLabel(m.PropertyViewing.title).fill(viewing);
  await viewingDialog.getByLabel(m.PropertyViewing.dueAt).fill(dateTimeLocal(1, 10));
  await viewingDialog.getByRole('button', { name: m.PropertyViewing.submit }).click();
  await expect(viewingDialog).toBeHidden();

  // 6. Complete it on the deal, with the next action.
  await page.goto(BUYER_DEAL);
  await page.getByRole('button', { name: m.OpportunityTaskList.completeTask.replace('{title}', viewing) }).click();
  const completeDialog = page.getByRole('dialog');
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.outcome.label).fill('Liked the layout; asks about parking.');
  await completeDialog.getByRole('button', { name: m.TaskCompleteDialog.fields.nextTask.schedule }).click();
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.nextTask.title).fill(followUp);
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.nextTask.dueDate).fill(dateTimeLocal(2, 11));
  await completeDialog.getByRole('button', { name: m.TaskCompleteDialog.actions.submit }).click();
  await expect(completeDialog).toBeHidden();

  // 7. `viewed` on both pages.
  await page.reload();
  await expect(statusOnDeal).toContainText(m.Enums.propertyLinkStatus.viewed);
  await page.goto(propertyUrl);
  await expect(deals.getByText(m.Enums.propertyLinkStatus.viewed)).toBeVisible();
});

test("another agency can't open an Alpha property", async ({ page, m, signInAs }) => {
  await signInAs('broker@beta.bg');

  const response = await page.goto(ALPHA_PROPERTY);

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: m.PropertyDetail.history })).toHaveCount(0);
});
