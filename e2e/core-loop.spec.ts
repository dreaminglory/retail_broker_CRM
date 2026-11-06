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
  await page.getByRole('option', { name: 'Charlie AlphaBroker', exact: true }).click(); // seeded first + last name
  await inquiryDialog.getByLabel(m.InquiryForm.callerName).fill(caller);
  // Unique per run: a phone already on a contact opens the duplicate warning at conversion.
  await inquiryDialog.getByLabel(m.InquiryForm.phone).fill(`+359888${String(Date.now()).slice(-6)}`);
  await inquiryDialog.getByLabel(m.InquiryForm.subject).fill('2-bedroom in Lozenets');
  await inquiryDialog.getByRole('button', { name: m.InquiryForm.submit }).click();
  await expect(inquiryDialog).toBeHidden();

  // 2. Convert it into an opportunity with a new contact.
  // The innermost element holding both the caller and the actions button is the card.
  const card = page.locator('div').filter({ has: page.getByText(caller, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: m.InquiryCard.actions }) }).last();
  await card.getByRole('button', { name: m.InquiryCard.actions }).click();
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

// AC-1, AC-7 (conversion-join): a repeat caller's inquiry joins their open deal instead of
// creating a second one; the call back lands on Today and the deal timeline shows the inquiry.
test("a broker joins a repeat caller's inquiry to their open deal", async ({ page, m, signInAs }, testInfo) => {
  const run = `${testInfo.project.name}-${Date.now()}`;
  const caller = `E2E Repeat ${run}`;
  const callBack = `E2E join call ${run}`;
  const alphaOpp1 = '/opportunities/11111111-6666-6666-6666-666666666661'; // Ivan Ivanov's seeded deal

  await signInAs('broker@alpha.bg');

  // 1. Log an inquiry from Ivan's phone (seeded contact with an open deal).
  await page.goto('/inquiries');
  await page.getByRole('button', { name: m.InquiriesPage.logInquiryBtn }).click();
  const inquiryDialog = page.getByRole('dialog');
  await inquiryDialog.getByRole('combobox', { name: m.InquiryForm.source }).click();
  await page.getByRole('option', { name: 'Imot.bg' }).click();
  await inquiryDialog.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Charlie AlphaBroker', exact: true }).click();
  await inquiryDialog.getByLabel(m.InquiryForm.callerName).fill(caller);
  await inquiryDialog.getByLabel(m.InquiryForm.phone).fill('+359888111222');
  await inquiryDialog.getByLabel(m.InquiryForm.subject).fill('One more question');
  await inquiryDialog.getByRole('button', { name: m.InquiryForm.submit }).click();
  await expect(inquiryDialog).toBeHidden();

  // 2. Convert: the duplicate check offers Ivan, who we use, then join his deal.
  const card = page.locator('div').filter({ has: page.getByText(caller, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: m.InquiryCard.actions }) }).last();
  await card.getByRole('button', { name: m.InquiryCard.actions }).click();
  await page.getByRole('menuitem', { name: m.InquiryCard.convertToOpportunity }).click();
  const convertDialog = page.getByRole('dialog').filter({ hasText: m.ConvertInquiryDialog.title });
  await convertDialog.getByRole('button', { name: m.ConvertInquiryDialog.convert, exact: true }).click();
  await page.getByRole('button', { name: m.DuplicateSuggestionModal.useContact }).first().click();
  await convertDialog.getByRole('radio', { name: m.ConvertInquiryDialog.modeJoin }).click();
  await expect(convertDialog.getByText('Alpha Opp 1')).toBeVisible();
  await convertDialog.getByLabel(m.ConvertInquiryDialog.callBackTitleLabel).fill(callBack);
  await convertDialog.getByRole('button', { name: m.ConvertInquiryDialog.join, exact: true }).click();

  // 3. We land on the existing deal, and the inquiry is on its timeline as joined.
  await page.waitForURL(new RegExp(`${alphaOpp1}$`));
  await expect(page.getByTestId('inquiry-joined-on').first()).toBeVisible();

  // 4. The call back is on Today, and the inquiry card says where it went.
  await page.goto('/today');
  await expect(page.getByText(callBack, { exact: true })).toBeVisible();
  await page.goto('/inquiries');
  await expect(page.getByText(m.InquiryCard.joinedTo.replace('{title}', 'Alpha Opp 1')).first()).toBeVisible();
});
