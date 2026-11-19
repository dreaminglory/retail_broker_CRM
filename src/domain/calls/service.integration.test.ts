import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { ContactService } from '@/domain/contacts/service';
import { InquiryService } from '@/domain/inquiries/service';
import { OpportunityService } from '@/domain/opportunities/service';
import { rescheduleDueAt } from '@/domain/tasks/reschedule';
import type { Task } from '@/domain/tasks/types';
import { TaskService } from '@/domain/tasks/service';
import { TimelineService } from '@/domain/timeline/service';
import { CallService } from './service';
import type { LogCallInput } from './types';

const TZ = 'Europe/Sofia';
const TITLES = { call: 'Call with Test', followUp: 'Follow up with Test', retry: 'Call again: Test' };

/** CallService.log against the local stack, as seeded members (spec phone-loop AC-2, AC-3, AC-5, AC-7). */
describeServices('CallService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let owner: TestSession;
  let calls: CallService;
  let stageId: string;
  let otherStageId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    owner = await signInAs('owner@alpha.bg');
    calls = new CallService(broker.db, { timezone: TZ });
    const { data: stages } = await broker.db.from('stages').select('id, name, is_terminal').eq('agency_id', broker.agencyId).order('sort_order');
    stageId = stages!.find((s) => s.name === 'New')!.id;
    otherStageId = stages!.find((s) => s.name !== 'New' && !s.is_terminal)!.id;
  });

  afterAll(() => cleanup.run());

  async function createInquiry() {
    const inquiry = await new InquiryService(broker.db).create(broker.agencyId, broker.userId, {
      caller_name: 'Call Test',
      caller_phone: '0888 000 111',
    });
    cleanup.track('inquiries', inquiry.id);
    return inquiry;
  }

  async function createDeal() {
    const deal = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: 'Call deal',
      type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
    });
    cleanup.track('opportunities', deal.id);
    return deal;
  }

  async function pendingCall(session: TestSession, at: { opportunity_id?: string; inquiry_id?: string }, due: string) {
    const { data, error } = await session.db
      .from('tasks')
      .insert({
        agency_id: session.agencyId,
        title: 'Planned call',
        task_type: 'call',
        status: 'pending',
        due_at: due,
        assigned_to: session.userId,
        created_by: session.userId,
        ...at,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    cleanup.track('tasks', data.id);
    return data as Task;
  }

  async function log(input: Omit<LogCallInput, 'name'>, now?: Date) {
    const result = await calls.log(broker.agencyId, broker.userId, { name: 'Test', ...input }, TITLES, now);
    cleanup.track('tasks', result.callTask.id);
    cleanup.track('tasks', result.nextTask?.id);
    return result;
  }

  async function tasksOf(column: 'inquiry_id' | 'opportunity_id', id: string) {
    const { data } = await broker.db.from('tasks').select('*').eq(column, id).order('created_at');
    data?.forEach((t) => cleanup.track('tasks', t.id));
    return (data ?? []) as (Task & { channel: string | null; inquiry_id: string | null })[];
  }

  it('logs a no-answer on a new inquiry with a retry in 1 h (AC-2)', async () => {
    const inquiry = await createInquiry();
    const before = Date.now();

    const { callTask, nextTask } = await log({
      context: { inquiry_id: inquiry.id },
      channel: 'phone',
      result: 'no_answer',
      outcome: 'No answer',
      next: { preset: 'plus_1h' },
    });

    expect(callTask).toMatchObject({
      status: 'completed',
      task_type: 'call',
      channel: 'phone',
      inquiry_id: inquiry.id,
      outcome: 'No answer',
      title: 'Call with Test',
      assigned_to: broker.userId,
    });
    expect(nextTask).toMatchObject({ status: 'pending', task_type: 'call', title: 'Call again: Test', inquiry_id: inquiry.id, assigned_to: broker.userId });
    const due = new Date(nextTask!.due_at!).getTime();
    expect(due).toBeGreaterThanOrEqual(before + 3_600_000 - 5_000);
    expect(due).toBeLessThanOrEqual(Date.now() + 3_600_000 + 5_000);

    const { data: after } = await broker.db.from('inquiries').select('status, contacted_at').eq('id', inquiry.id).single();
    expect(after!.status).toBe('contacted');
    expect(after!.contacted_at).not.toBeNull();

    // The inbox card shows the contact time, the last call and the retry (rule 9).
    const [listed] = (await new InquiryService(broker.db).list(broker.agencyId, { search: 'Call Test', limit: 50 })).filter((i) => i.id === inquiry.id);
    expect(listed.contacted_at).toBe(after!.contacted_at);
    expect(listed.calls).toEqual({
      lastCall: { outcome: 'No answer', at: callTask.completed_at, channel: 'phone' },
      nextRetryAt: nextTask!.due_at,
    });
  });

  it("completes the inquiry's pending retry next time instead of adding a call, and keeps contacted_at (AC-3)", async () => {
    const inquiry = await createInquiry();
    const first = await log({ context: { inquiry_id: inquiry.id }, channel: 'phone', result: 'no_answer', outcome: 'No answer', next: { preset: 'plus_1h' } });
    const { data: stamped } = await broker.db.from('inquiries').select('contacted_at').eq('id', inquiry.id).single();

    const found = await calls.findTaskToComplete(broker.agencyId, broker.userId, { inquiry_id: inquiry.id }, 'viber');
    expect(found?.id).toBe(first.nextTask!.id);

    const second = await log({
      context: { inquiry_id: inquiry.id },
      channel: 'viber',
      complete_task_id: found!.id,
      result: 'answered',
      outcome: 'Wants a viewing on Friday',
      next: null,
    });

    expect(second.callTask).toMatchObject({ id: first.nextTask!.id, status: 'completed', channel: 'viber', outcome: 'Wants a viewing on Friday' });
    expect(await tasksOf('inquiry_id', inquiry.id)).toHaveLength(2);
    const { data: after } = await broker.db.from('inquiries').select('contacted_at').eq('id', inquiry.id).single();
    expect(after!.contacted_at).toBe(stamped!.contacted_at);
  });

  it("never picks or completes another member's call task", async () => {
    const deal = await createDeal();
    const theirs = await pendingCall(owner, { opportunity_id: deal.id }, new Date(Date.now() - 60_000).toISOString());

    expect(await calls.findTaskToComplete(broker.agencyId, broker.userId, { opportunity_id: deal.id }, 'phone')).toBeNull();
    expect(await calls.findTaskToComplete(broker.agencyId, broker.userId, { opportunity_id: deal.id, task_id: theirs.id }, 'phone')).toBeNull();

    const refused = await log({
      context: { opportunity_id: deal.id },
      channel: 'phone',
      complete_task_id: theirs.id,
      result: 'answered',
      outcome: 'Spoke',
      next: null,
    }).catch((e) => e);
    expect(refused).toBeInstanceOf(DomainError);
    expect(refused.message).toBe('phoneLoop.errors.taskNotCompletable');
  });

  it('picks the tapped task first, then my earliest call on the deal', async () => {
    const deal = await createDeal();
    const later = await pendingCall(broker, { opportunity_id: deal.id }, new Date(Date.now() + 7_200_000).toISOString());
    const earlier = await pendingCall(broker, { opportunity_id: deal.id }, new Date(Date.now() + 3_600_000).toISOString());

    expect((await calls.findTaskToComplete(broker.agencyId, broker.userId, { opportunity_id: deal.id }, 'phone'))?.id).toBe(earlier.id);
    expect((await calls.findTaskToComplete(broker.agencyId, broker.userId, { opportunity_id: deal.id, task_id: later.id }, 'phone'))?.id).toBe(later.id);
    // An email can't complete a call task (tasks_channel_check).
    expect(await calls.findTaskToComplete(broker.agencyId, broker.userId, { opportunity_id: deal.id }, 'email')).toBeNull();
  });

  it("completes my call on a deal and sets the deal's next action to tomorrow 09:00 (AC-5)", async () => {
    const deal = await createDeal();
    const planned = await pendingCall(broker, { opportunity_id: deal.id }, new Date(Date.now() + 3_600_000).toISOString());
    const now = new Date();

    const { callTask, nextTask } = await log(
      {
        context: { opportunity_id: deal.id },
        channel: 'phone',
        complete_task_id: planned.id,
        result: 'answered',
        outcome: 'Agreed to view',
        next: { preset: 'tomorrow_9' },
        new_stage_id: otherStageId,
      },
      now,
    );

    expect(callTask).toMatchObject({ id: planned.id, status: 'completed', channel: 'phone' });
    expect(nextTask).toMatchObject({ title: 'Follow up with Test', opportunity_id: deal.id, assigned_to: broker.userId });
    const { data: after } = await broker.db.from('opportunities').select('next_action_at, stage_id').eq('id', deal.id).single();
    expect(new Date(after!.next_action_at).toISOString()).toBe(rescheduleDueAt('tomorrow_9', TZ, now).toISOString());
    expect(after!.stage_id).toBe(otherStageId);
  });

  it('leaves a deal on At risk after an answered call with no next action (AC-5, rule 7)', async () => {
    const deal = await createDeal();
    const planned = await pendingCall(broker, { opportunity_id: deal.id }, new Date(Date.now() + 3_600_000).toISOString());

    await log({ context: { opportunity_id: deal.id }, channel: 'phone', complete_task_id: planned.id, result: 'answered', outcome: 'Thinking it over', next: null });

    const atRisk = await new TaskService(broker.db, { timezone: TZ }).listAtRisk(broker.agencyId, broker.userId);
    expect(atRisk.map((o) => o.id)).toContain(deal.id);
  });

  it('logs an email as a completed email task', async () => {
    const deal = await createDeal();
    const { callTask } = await log({ context: { opportunity_id: deal.id }, channel: 'email', result: 'answered', outcome: 'Sent the offer', next: null });
    expect(callTask).toMatchObject({ task_type: 'email', channel: 'email', status: 'completed', opportunity_id: deal.id });
  });

  it('logs a call on a won deal but refuses a stage change there (rule 8)', async () => {
    const deal = await createDeal();
    await new OpportunityService(broker.db).close(deal.id, broker.agencyId, { outcome: 'won' });

    const logged = await log({ context: { opportunity_id: deal.id }, channel: 'phone', result: 'answered', outcome: 'Thanked us', next: null });
    expect(logged.callTask.status).toBe('completed');

    const refused = await log({
      context: { opportunity_id: deal.id },
      channel: 'phone',
      result: 'answered',
      outcome: 'Thanked us',
      next: null,
      new_stage_id: otherStageId,
    }).catch((e) => e);
    expect(refused.message).toBe('phoneLoop.errors.stageClosed');
  });

  it('logs a call on a dismissed inquiry but offers no retry (rule 8)', async () => {
    const inquiry = await createInquiry();
    await new InquiryService(broker.db).dismiss(inquiry.id, broker.agencyId, { dismissed_reason: 'Spam' });

    const refused = await log({ context: { inquiry_id: inquiry.id }, channel: 'phone', result: 'no_answer', outcome: 'No answer', next: { preset: 'plus_1h' } }).catch((e) => e);
    expect(refused.message).toBe('phoneLoop.errors.noRetryDismissed');

    const logged = await log({ context: { inquiry_id: inquiry.id }, channel: 'phone', result: 'no_answer', outcome: 'No answer', next: null });
    expect(logged.nextTask).toBeUndefined();
    const { data: after } = await broker.db.from('inquiries').select('status').eq('id', inquiry.id).single();
    expect(after!.status).toBe('dismissed');
  });

  it('refuses today 18:00 at or after 17:00 agency time', async () => {
    const inquiry = await createInquiry();
    const at1730 = new Date('2026-01-15T15:30:00Z');
    const refused = await log({ context: { inquiry_id: inquiry.id }, channel: 'phone', result: 'no_answer', outcome: 'No answer', next: { preset: 'today_18' } }, at1730).catch((e) => e);
    expect(refused.message).toBe('phoneLoop.errors.today18Passed');
    expect(await tasksOf('inquiry_id', inquiry.id)).toEqual([]);
  });

  it('stamps the logged call with the time it was given', async () => {
    const inquiry = await createInquiry();
    const at = new Date('2026-01-15T08:00:00Z');
    const { callTask } = await log({ context: { inquiry_id: inquiry.id }, channel: 'phone', result: 'no_answer', outcome: 'No answer', next: null }, at);
    expect(new Date(callTask.completed_at!).toISOString()).toBe(at.toISOString());
  });

  it("refuses a deal that isn't the converted inquiry's own", async () => {
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, { type: 'person', first_name: 'Call', last_name: 'Mismatch' });
    cleanup.track('contacts', contact.id);
    const joined = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: 'Joined deal',
      type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
      primary_contact_id: contact.id,
    });
    cleanup.track('opportunities', joined.id);
    const other = await createDeal();
    const inquiry = await createInquiry();
    await new InquiryService(broker.db).join(inquiry.id, broker.agencyId, { contact_id: contact.id, opportunity_id: joined.id, task: null });

    const refused = await log({ context: { inquiry_id: inquiry.id, opportunity_id: other.id }, channel: 'phone', result: 'answered', outcome: 'Spoke', next: null }).catch((e) => e);
    expect(refused).toBeInstanceOf(DomainError);
    expect(refused.message).toBe('phoneLoop.errors.contextMismatch');
    expect(await tasksOf('opportunity_id', other.id)).toEqual([]);

    // Its own deal is fine.
    const logged = await log({ context: { inquiry_id: inquiry.id, opportunity_id: joined.id }, channel: 'phone', result: 'answered', outcome: 'Spoke', next: null });
    expect(logged.callTask.opportunity_id).toBe(joined.id);
  });

  it("shows an inquiry's Viber call on the deal timeline after it joins (AC-4, rule 10)", async () => {
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, { type: 'person', first_name: 'Call', last_name: 'Timeline' });
    cleanup.track('contacts', contact.id);
    const deal = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: 'Timeline deal',
      type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
      primary_contact_id: contact.id,
    });
    cleanup.track('opportunities', deal.id);
    const inquiry = await createInquiry();
    const { callTask } = await log({ context: { inquiry_id: inquiry.id }, channel: 'viber', result: 'answered', outcome: 'Chatted on Viber', next: null });

    await new InquiryService(broker.db).join(inquiry.id, broker.agencyId, { contact_id: contact.id, opportunity_id: deal.id, task: null });

    const timeline = await new TimelineService(broker.db).getOpportunityTimeline(deal.id, broker.agencyId);
    const entry = timeline.find((e) => e.type === 'task' && e.isCompletionEvent && e.data.id === callTask.id);
    expect(entry?.type === 'task' && entry.data.channel).toBe('viber');
  });

  it("refuses another agency's inquiry (AC-7)", async () => {
    const inquiry = await createInquiry();
    const beta = await signInAs('broker@beta.bg');
    const refused = await new CallService(beta.db, { timezone: TZ })
      .log(beta.agencyId, beta.userId, { name: 'X', context: { inquiry_id: inquiry.id }, channel: 'phone', result: 'no_answer', outcome: 'No answer', next: null }, TITLES)
      .catch((e) => e);
    expect(refused).toBeInstanceOf(DomainError);
    expect(refused.message).toBe('errors.not_found');
    expect(await tasksOf('inquiry_id', inquiry.id)).toEqual([]);
  });
});
