import { test, expect, dateTimeLocal, formatMessage, serviceRest } from './fixtures';

// Smart lists (spec: smart-lists, Task 14): the overview, saving a list from the deal filters,
// working it through to "List done", and a shared list a broker sees read-only. Each run works
// on its own tagged deals and lists, so the seeded rows other specs count stay as they were.

type Profile = { id: string };
type Deal = { id: string; agency_id: string; stage_id: string; source_id: string | null };

/** Two active deals with no next action, owned by Alpha's broker and tagged with `tag`. */
async function createTaggedDeals(tag: string): Promise<Deal[]> {
  const [broker] = await serviceRest<Profile[]>(`profiles?select=id&email=eq.${encodeURIComponent('broker@alpha.bg')}`);
  const [seeded] = await serviceRest<Deal[]>(
    `opportunities?select=id,agency_id,stage_id,source_id&assigned_to=eq.${broker.id}&title=eq.${encodeURIComponent('SL No action')}`
  );
  const base = {
    agency_id: seeded.agency_id,
    stage_id: seeded.stage_id,
    source_id: seeded.source_id,
    assigned_to: broker.id,
    type: 'buyer',
    status: 'active',
    temperature: 'warm',
  };
  return serviceRest<Deal[]>('opportunities', {
    method: 'POST',
    body: [{ ...base, title: `${tag} A` }, { ...base, title: `${tag} B` }],
  });
}

/** Takes the run's deals out of every default list (archived), so they don't pile up. */
async function archiveTaggedDeals(tag: string): Promise<void> {
  await serviceRest(`opportunities?title=like.${encodeURIComponent(`${tag}*`)}`, {
    method: 'PATCH',
    body: { status: 'archived' },
  });
}

test('a broker saves a list from the deal filters and works it through to List done', async ({ page, m, appLocale, signInAs }, testInfo) => {
  const tag = `E2E SL ${testInfo.project.name}-${Date.now()}`;
  const listName = `E2E list ${tag}`;
  const q = m.smartLists.queue;
  await createTaggedDeals(tag);

  try {
    await signInAs('broker@alpha.bg');

    // The overview lists the built-in lists with their counts.
    await page.goto('/lists');
    await expect(page.getByRole('heading', { name: m.smartLists.overview.title })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(m.smartLists.builtIn.noNextAction) })).toBeVisible();

    async function scheduleTask(title: string) {
      await page.getByRole('button', { name: m.OpportunityTaskList.addBtn }).click();
      const taskDialog = page.getByRole('dialog');
      await taskDialog.getByLabel(m.OpportunityTaskList.taskTitleLabel).fill(title);
      await taskDialog.getByLabel(m.OpportunityTaskList.dueAtLabel).fill(dateTimeLocal(2, 10));
      await taskDialog.getByRole('button', { name: m.OpportunityTaskList.submitAdd }).click();
      await expect(taskDialog).toBeHidden();
    }

    // Save the run's deals without a next action as a list.
    await page.goto(`/opportunities?search=${encodeURIComponent(tag)}&next=none`);
    await page.getByRole('button', { name: m.smartLists.saved.saveAsList }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(m.smartLists.saved.nameLabel).fill(listName);
    await dialog.getByRole('button', { name: m.smartLists.saved.save }).click();
    await page.waitForURL(/\/lists\/[0-9a-f-]{36}$/);
    const listUrl = page.url();
    await expect(page.getByRole('heading', { name: listName })).toBeVisible();
    await expect(page.getByText(formatMessage(appLocale, m.smartLists.page.dealCount, { count: 2 }))).toBeVisible();

    // A list saved from the page opens in Edit filters without the warning.
    await page.getByRole('link', { name: m.smartLists.saved.editFilters }).click();
    await expect(page.getByRole('button', { name: m.smartLists.saved.updateList })).toBeVisible();
    await expect(page.getByText(m.smartLists.saved.notShownExactly)).toHaveCount(0);

    // It is under Saved after a reload, with its count.
    await page.goto('/lists');
    await expect(page.getByRole('link', { name: new RegExp(listName) })).toContainText('2');

    // Work through: schedule a task on each deal and press Next; the list shrinks as it goes.
    await page.goto(listUrl);
    await page.getByRole('link', { name: q.workThrough }).click();
    await page.waitForURL(/\/opportunities\/[0-9a-f-]+\?.*list=/);
    const bar = page.getByRole('navigation', { name: formatMessage(appLocale, q.label, { name: listName }) });
    await expect(bar).toContainText(formatMessage(appLocale, q.position, { pos: 1, total: 2 }));
    const firstDealPath = new URL(page.url()).pathname;

    // Deal 1 gets a next action and leaves the list: Next opens the other deal, one left.
    await scheduleTask(`E2E call 1 ${tag}`);
    await bar.getByRole('link', { name: q.next, exact: true }).click();
    await page.waitForURL((url) => url.pathname.startsWith('/opportunities/') && url.pathname !== firstDealPath);
    await expect(bar).toContainText(formatMessage(appLocale, q.position, { pos: 2, total: 1 }));

    // Deal 2 too: Next ends the list with List done, and the list is empty.
    await scheduleTask(`E2E call 2 ${tag}`);
    await bar.getByRole('link', { name: q.next, exact: true }).click();
    await page.waitForURL(/\/lists\/[0-9a-f-]{36}\?done=1/);
    await expect(page.getByText(q.doneTitle)).toBeVisible();
    await expect(page.getByText(m.smartLists.page.emptyTitle)).toBeVisible();

    // Delete the list (confirm); it is gone from the overview.
    await page.getByRole('button', { name: m.smartLists.saved.delete }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: m.smartLists.saved.delete }).click();
    await page.waitForURL(/\/lists$/);
    await expect(page.getByRole('link', { name: new RegExp(listName) })).toHaveCount(0);
  } finally {
    await archiveTaggedDeals(tag);
  }
});

test('a manager shares a list and a broker sees it read-only', async ({ page, m, appLocale, signInAs }, testInfo) => {
  const listName = `E2E shared ${testInfo.project.name}-${Date.now()}`;
  let listId: string | undefined;

  try {
    await signInAs('manager@alpha.bg');
    await page.goto('/opportunities?type=seller');
    await page.getByRole('button', { name: m.smartLists.saved.saveAsList }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(m.smartLists.saved.nameLabel).fill(listName);
    await dialog.getByRole('button', { name: m.smartLists.saved.save }).click();
    await page.waitForURL(/\/lists\/[0-9a-f-]{36}$/);
    listId = page.url().split('/').pop();

    await page.getByRole('button', { name: m.smartLists.saved.share }).click();
    await expect(page.getByText(m.smartLists.overview.shared)).toBeVisible();
    await expect(page.getByRole('button', { name: m.smartLists.saved.unshare })).toBeVisible();

    // The broker sees it, marked with who shared it, and has no controls to change it.
    await page.context().clearCookies();
    await signInAs('broker@alpha.bg');
    await page.goto('/lists');
    const row = page.getByRole('link', { name: new RegExp(listName) });
    await expect(row).toContainText(formatMessage(appLocale, m.smartLists.overview.sharedBy, { name: 'Bob AlphaManager' }));
    await row.click();
    await expect(page.getByRole('heading', { name: listName })).toBeVisible();
    await expect(page.getByText(m.smartLists.overview.shared)).toBeVisible();
    for (const control of [m.smartLists.saved.rename, m.smartLists.saved.delete, m.smartLists.saved.share, m.smartLists.saved.unshare]) {
      await expect(page.getByRole('button', { name: control })).toHaveCount(0);
    }
    await expect(page.getByRole('link', { name: m.smartLists.saved.editFilters })).toHaveCount(0);
  } finally {
    if (listId) await serviceRest(`smart_lists?id=eq.${listId}`, { method: 'DELETE' });
  }
});

test('Edit filters warns when the page cannot show a list filter as it is', async ({ page, m, signInAs }) => {
  // The seeded "SL My hot deals" is { temperature: hot, assigned_to: me }; the deal list has no "me".
  await signInAs('broker@alpha.bg');
  await page.goto('/lists');
  await page.getByRole('link', { name: /SL My hot deals/ }).click();
  await page.getByRole('link', { name: m.smartLists.saved.editFilters }).click();
  await page.waitForURL(/\/opportunities\?.*list=/);
  await expect(page.getByText(m.smartLists.saved.notShownExactly)).toBeVisible();
  await expect(page.getByRole('button', { name: m.smartLists.saved.updateList })).toBeVisible();
});
