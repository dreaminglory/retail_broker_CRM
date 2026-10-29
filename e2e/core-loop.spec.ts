import { test, expect, dateTimeLocal } from './fixtures';

// FR-TST-06 / AC-6.1-2: the core loop end to end, as a broker, in each project's
// locale and viewport. inquiry → convert → task on the opportunity → Today →
// complete with a next action → the next action is on Today.

test('a broker takes an inquiry through to a scheduled next action', async ({ page, m, signInAs }, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now()}`;
  const caller = `E2E Caller ${run}`;
  const firstTask = `E2E call ${run}`;
  const nextTask = `E2E viewing ${run}`;

  await signInAs('broker@alpha.bg');

  // 1. Log an inquiry.
  await page.goto('/inquiries');
  await page.getByRole('button', { name: m.InquiriesPage.logInquiryBtn }).click();
  const inquiryDialog = page.getByRole('dialog');
  await inquiryDialog.getByRole('combobox', { name: m.InquiryForm.source }).click();
  await page.getByRole('option', { name: 'Imot.bg' }).click(); // seeded lead source
  // The broker takes the inquiry they logged. (Leaving it "Unassigned" fails
  // validation today: BrokerSelect posts "none". Tracked separately.)
  await inquiryDialog.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'broker', exact: true }).click(); // seeded display name
  await inquiryDialog.getByLabel(m.InquiryForm.callerName).fill(caller);
  await inquiryDialog.getByLabel(m.InquiryForm.phone).fill('+359888123456');
  await inquiryDialog.getByLabel(m.InquiryForm.subject).fill('2-bedroom in Lozenets');
  await inquiryDialog.getByRole('button', { name: m.InquiryForm.submit }).click();
  await expect(inquiryDialog).toBeHidden();

  // 2. Convert it into an opportunity with a new contact.
  // The innermost element holding both the caller and the actions button is the card.
  // ("Inquiry actions" is a hard-coded English aria-label; i18n fix is slice 6.5.)
  const card = page.locator('div').filter({ has: page.getByText(caller, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Inquiry actions' }) }).last();
  await card.getByRole('button', { name: 'Inquiry actions' }).click();
  await page.getByRole('menuitem', { name: m.InquiryCard.convertToOpportunity }).click();
  const convertDialog = page.getByRole('dialog');
  await convertDialog.getByLabel(m.ConvertInquiryDialog.oppTitle).fill(`E2E opportunity ${run}`);
  await convertDialog.getByRole('button', { name: m.ConvertInquiryDialog.convert, exact: true }).click();
  await expect(convertDialog).toBeHidden();

  // 3. Schedule the first task on the opportunity page.
  await page.goto('/opportunities');
  await page.getByRole('link', { name: `E2E opportunity ${run}` }).click();
  await page.waitForURL(/\/opportunities\/[0-9a-f-]+$/);
  const opportunityUrl = page.url();
  await page.getByRole('button', { name: m.OpportunityTaskList.addBtn }).click();
  const taskDialog = page.getByRole('dialog');
  await taskDialog.getByLabel(m.OpportunityTaskList.taskTitleLabel).fill(firstTask);
  await taskDialog.getByLabel(m.OpportunityTaskList.dueAtLabel).fill(dateTimeLocal(2, 10));
  await taskDialog.getByRole('button', { name: m.OpportunityTaskList.submitAdd }).click();
  await expect(taskDialog).toBeHidden();
  // The title shows in the task list and in the activity timeline.
  await expect(page.getByText(firstTask).first()).toBeVisible();

  // 4. The broker sees it on Today and completes it with a next action.
  await page.goto('/today');
  await expect(page.getByText(firstTask, { exact: true })).toBeVisible();
  // The innermost element holding both the title and a Complete button is the task card.
  await page.locator('div')
    .filter({ has: page.getByText(firstTask, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: m.TaskCard.complete }) })
    .last()
    .getByRole('button', { name: m.TaskCard.complete })
    .click();
  const completeDialog = page.getByRole('dialog');
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.outcome.label).fill('Spoke with the caller; wants a viewing.');
  await completeDialog.getByRole('button', { name: m.TaskCompleteDialog.fields.nextTask.schedule }).click();
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.nextTask.title).fill(nextTask);
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.nextTask.dueDate).fill(dateTimeLocal(3, 11));
  await completeDialog.getByRole('button', { name: m.TaskCompleteDialog.actions.submit }).click();
  await expect(completeDialog).toBeHidden();

  // 5. The completed task is gone from Today and the next action is there.
  await page.reload();
  await expect(page.getByText(nextTask, { exact: true })).toBeVisible();
  await expect(page.getByText(firstTask)).toHaveCount(0);

  // ...and the opportunity carries the next action too.
  await page.goto(opportunityUrl);
  await expect(page.getByText(nextTask).first()).toBeVisible();
});

// AC-6.2-2 (FR-TSK-04): completing on the opportunity page keeps the next task.
test('a broker completes a task with a next action on the opportunity page', async ({ page, m, signInAs }, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now()}`;
  const firstTask = `E2E opp call ${run}`;
  const nextTask = `E2E opp viewing ${run}`;

  await signInAs('broker@alpha.bg');
  await page.goto('/opportunities/11111111-6666-6666-6666-666666666661'); // seeded "Alpha Opp 1"

  await page.getByRole('button', { name: m.OpportunityTaskList.addBtn }).click();
  const taskDialog = page.getByRole('dialog');
  await taskDialog.getByLabel(m.OpportunityTaskList.taskTitleLabel).fill(firstTask);
  await taskDialog.getByLabel(m.OpportunityTaskList.dueAtLabel).fill(dateTimeLocal(2, 10));
  await taskDialog.getByRole('button', { name: m.OpportunityTaskList.submitAdd }).click();
  await expect(taskDialog).toBeHidden();

  await page.getByRole('button', { name: m.OpportunityTaskList.completeTask.replace('{title}', firstTask) }).click();
  const completeDialog = page.getByRole('dialog');
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.outcome.label).fill('Left a voicemail.');
  await completeDialog.getByRole('button', { name: m.TaskCompleteDialog.fields.nextTask.schedule }).click();
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.nextTask.title).fill(nextTask);
  await completeDialog.getByLabel(m.TaskCompleteDialog.fields.nextTask.dueDate).fill(dateTimeLocal(3, 11));
  await completeDialog.getByRole('button', { name: m.TaskCompleteDialog.actions.submit }).click();
  await expect(completeDialog).toBeHidden();

  await page.reload();
  await expect(page.getByText(nextTask).first()).toBeVisible({ timeout: 5_000 });
});
