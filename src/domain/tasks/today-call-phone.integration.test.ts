import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { ContactService } from '@/domain/contacts/service';
import { InquiryService } from '@/domain/inquiries/service';
import { OpportunityService } from '@/domain/opportunities/service';
import { TaskService } from './service';
import type { Task } from './types';

/** Today's call tasks carry a phone to call (spec phone-loop rule 1, T8). */
describeServices("Today call tasks' phone against the local stack", () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let tasks: TaskService;
  let stageId: string;
  const suffix = String(Date.now()).slice(-6);

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    tasks = new TaskService(broker.db, { timezone: 'Europe/Sofia' });
    const { data: stage } = await broker.db.from('stages').select('id').eq('agency_id', broker.agencyId).eq('name', 'New').single();
    stageId = stage!.id;
  });

  afterAll(() => cleanup.run());

  async function pendingCallNow(at: Partial<Pick<Task, 'opportunity_id' | 'contact_id' | 'inquiry_id'>>) {
    const { data, error } = await broker.db
      .from('tasks')
      .insert({
        agency_id: broker.agencyId,
        title: 'Today call',
        task_type: 'call',
        status: 'pending',
        due_at: new Date(Date.now() - 60_000).toISOString(),
        assigned_to: broker.userId,
        created_by: broker.userId,
        ...at,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    cleanup.track('tasks', data.id);
    return data as Task;
  }

  async function todayTask(id: string) {
    const { overdue, dueToday, upcoming } = await tasks.listToday(broker.agencyId, broker.userId);
    return [...overdue, ...dueToday, ...upcoming].find((t) => t.id === id);
  }

  it("gives a deal's call task its contact's primary phone and the deal status", async () => {
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: 'Today',
      last_name: 'Phone',
      contact_methods: [
        { type: 'phone', value: `+3592${suffix}1`, label: null, is_primary: false },
        { type: 'phone', value: `+359888${suffix}`, label: null, is_primary: true },
      ],
    });
    cleanup.track('contacts', contact.id);
    const deal = await new OpportunityService(broker.db).create(broker.agencyId, broker.userId, {
      title: 'Today phone deal',
      type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
      primary_contact_id: contact.id,
    });
    cleanup.track('opportunities', deal.id);
    const task = await pendingCallNow({ opportunity_id: deal.id, contact_id: contact.id });
    // Most deal tasks carry no contact: the deal's primary contact is called.
    const dealOnly = await pendingCallNow({ opportunity_id: deal.id });

    const row = await todayTask(task.id);
    expect(row?.call_phone).toEqual({ value: `+359888${suffix}`, type: 'phone', name: 'Today Phone' });
    expect(row?.opportunity_status).toBe('active');
    expect((await todayTask(dealOnly.id))?.call_phone).toEqual(row?.call_phone);
  });

  it("gives an inquiry's call task the caller phone", async () => {
    const inquiry = await new InquiryService(broker.db).create(broker.agencyId, broker.userId, {
      caller_name: 'Today Caller',
      caller_phone: `0887 ${suffix}`,
    });
    cleanup.track('inquiries', inquiry.id);
    const task = await pendingCallNow({ inquiry_id: inquiry.id });

    const row = await todayTask(task.id);
    expect(row?.call_phone).toEqual({ value: inquiry.caller_phone, type: 'phone', name: 'Today Caller' });
    expect(row?.opportunity_status ?? null).toBeNull();
  });

  it("counts each deal's pending tasks of anyone (rule 7 warning on the contact page)", async () => {
    const opportunities = new OpportunityService(broker.db);
    const deal = await opportunities.create(broker.agencyId, broker.userId, { title: 'Pending count deal', type: 'buyer', stage_id: stageId, assigned_to: broker.userId });
    cleanup.track('opportunities', deal.id);
    const empty = await opportunities.create(broker.agencyId, broker.userId, { title: 'No tasks deal', type: 'buyer', stage_id: stageId, assigned_to: broker.userId });
    cleanup.track('opportunities', empty.id);
    await pendingCallNow({ opportunity_id: deal.id });
    await pendingCallNow({ opportunity_id: deal.id });

    expect(await tasks.pendingCounts(broker.agencyId, [deal.id, empty.id])).toEqual({ [deal.id]: 2 });
    expect(await tasks.pendingCounts(broker.agencyId, [])).toEqual({});
  });

  it("loads a deal's contacts with their methods (opportunity page links)", async () => {
    const contacts = new ContactService(broker.db);
    const contact = await contacts.create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: 'With',
      last_name: 'Methods',
      contact_methods: [{ type: 'phone', value: `+359889${suffix}`, label: null, is_primary: true }],
    });
    cleanup.track('contacts', contact.id);

    const [loaded] = await contacts.getByIdsWithMethods([contact.id], broker.agencyId);
    expect(loaded.contact_methods.map((m) => m.value)).toEqual([`+359889${suffix}`]);
    expect(await contacts.getByIdsWithMethods([], broker.agencyId)).toEqual([]);
  });
});
