import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExceptionsRepository } from '@/domain/exceptions/repository';
import { ProfileRepository } from '@/domain/profiles/repository';
import { adminClient, createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import type { MailMessage, MailResult, Mailer } from './mailer';
import { NotificationRepository } from './repository';
import { NotificationService } from './service';

const TIMEZONE = 'Europe/Sofia';
// A Monday, 08:10 in Sofia. The date is far from any seeded data, so only the rows made here
// are keyed to it and the deliveries can be cleared by period key.
const NOW = new Date('2031-03-10T06:10:00Z');
const PERIOD_KEY = '2031-03-10';
const APP_URL = 'http://localhost:3000';

/** Records what would be sent; `failFor` makes one address fail. */
function fakeMailer(failFor?: string) {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    async send(message): Promise<MailResult> {
      if (message.to === failFor) return { ok: false, error: 'Mailbox unavailable' };
      sent.push(message);
      return { ok: true, providerId: `fake-${sent.length}` };
    },
  };
  return { mailer, sent };
}

describeServices('NotificationService daily digest against the local stack', () => {
  const cleanup = createRowCleanup();
  const tempUserIds: string[] = [];
  let admin: SupabaseClient;
  let repo: NotificationRepository;
  let broker: TestSession;
  let manager: TestSession;
  let betaBroker: TestSession;

  async function clearDeliveries() {
    await admin.from('notification_deliveries').delete().eq('period_key', PERIOD_KEY);
  }

  beforeAll(async () => {
    admin = adminClient();
    repo = new NotificationRepository(admin);
    broker = await signInAs('broker@alpha.bg');
    manager = await signInAs('manager@alpha.bg');
    betaBroker = await signInAs('broker@beta.bg');
  });

  beforeEach(clearDeliveries);

  afterAll(async () => {
    if (!admin) return;
    await clearDeliveries();
    await cleanup.run();
    for (const id of tempUserIds) await admin.auth.admin.deleteUser(id);
  });

  async function createOverdueTask(userId: string, agencyId: string, title: string, dueAt = '2031-03-09T09:00:00Z') {
    const { data, error } = await admin
      .from('tasks')
      .insert({ agency_id: agencyId, title, due_at: dueAt, assigned_to: userId, status: 'pending' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.track('tasks', data.id);
  }

  /**
   * A member of Alpha made for one test, so the seeded users other suites sign in as are never
   * touched while those suites run in parallel. Removing the user removes the membership.
   */
  async function createTempMember(label: string, status: 'active' | 'deactivated' = 'active') {
    const email = `digest-${label}-${Date.now()}@alpha.bg`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
    if (error) throw new Error(error.message);
    tempUserIds.push(data.user.id);
    const { error: membershipError } = await admin
      .from('agency_memberships')
      .insert({ agency_id: broker.agencyId, user_id: data.user.id, role: 'broker', status });
    if (membershipError) throw new Error(membershipError.message);
    return { userId: data.user.id, email };
  }

  const service = (mailer: Mailer) => new NotificationService(repo, mailer, APP_URL);

  const run = (mailer: Mailer, agencyId = broker.agencyId) =>
    service(mailer).runDailyDigest({ agencyId, timezone: TIMEZONE, now: NOW });

  async function emailFor(userId: string): Promise<string> {
    const { data } = await admin.from('profiles').select('email').eq('id', userId).single();
    return data!.email;
  }

  async function deliveryFor(userId: string) {
    const { data } = await admin
      .from('notification_deliveries')
      .select('status, error')
      .eq('user_id', userId)
      .eq('period_key', PERIOD_KEY)
      .maybeSingle();
    return data;
  }

  it('lets one caller hold a claim: pending and sent block a repeat, failed and skipped do not (AD-051)', async () => {
    const claim = () => repo.claim(broker.agencyId, broker.userId, { kind: 'daily_digest', periodKey: PERIOD_KEY });

    const first = await claim();
    expect(first).toBeTruthy();
    expect(await claim()).toBeNull(); // in flight

    await repo.settle(broker.agencyId, first!, { status: 'failed', error: 'boom' });
    const second = await claim(); // a failed send is retried
    expect(second).toBe(first);
    expect(await deliveryFor(broker.userId)).toEqual({ status: 'pending', error: null });

    await repo.settle(broker.agencyId, second!, { status: 'skipped' });
    expect(await claim()).toBe(first); // an empty digest is looked at again

    await repo.settle(broker.agencyId, first!, { status: 'sent', providerId: 'p1' });
    expect(await claim()).toBeNull(); // sent is final
    expect(await deliveryFor(broker.userId)).toEqual({ status: 'sent', error: null });
  });

  it('sends one digest per user however many times it runs', async () => {
    await createOverdueTask(broker.userId, broker.agencyId, 'Digest task for the broker');
    const { mailer, sent } = fakeMailer();

    const first = await run(mailer);
    const second = await run(mailer);

    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(second.sent).toBe(0);
    expect(second.alreadyDone).toBe(first.sent);
    expect(second.skipped).toBe(first.skipped); // an empty digest is looked at again, and is still empty
    const recipients = sent.map((message) => message.to);
    expect(new Set(recipients).size).toBe(recipients.length);
    expect(recipients).toContain(await emailFor(broker.userId));
  });

  it('sends one digest per user when runs overlap', async () => {
    await createOverdueTask(broker.userId, broker.agencyId, 'Digest task for the broker');
    const { mailer, sent } = fakeMailer();

    await Promise.all([run(mailer), run(mailer), run(mailer)]);

    const recipients = sent.map((message) => message.to);
    expect(recipients.length).toBeGreaterThanOrEqual(1);
    expect(new Set(recipients).size).toBe(recipients.length);
  });

  it('records a failed send, carries on with the others, and retries it next run', async () => {
    await createOverdueTask(broker.userId, broker.agencyId, 'Digest task for the broker');
    await createOverdueTask(manager.userId, manager.agencyId, 'Digest task for the manager');
    const brokerEmail = await emailFor(broker.userId);

    const failing = fakeMailer(brokerEmail);
    const first = await run(failing.mailer);

    expect(first.failed).toBe(1);
    expect(failing.sent.map((m) => m.to)).toContain(await emailFor(manager.userId));
    expect(failing.sent.map((m) => m.to)).not.toContain(brokerEmail);
    expect(await deliveryFor(broker.userId)).toEqual({ status: 'failed', error: 'Mailbox unavailable' });

    const working = fakeMailer();
    const second = await run(working.mailer);

    expect(second.sent).toBe(1);
    expect(working.sent.map((m) => m.to)).toEqual([brokerEmail]);
    expect(await deliveryFor(broker.userId)).toEqual({ status: 'sent', error: null });
  });

  it("writes the recipient's own language and links to Today", async () => {
    await createOverdueTask(broker.userId, broker.agencyId, 'Digest task for the broker');
    const { mailer, sent } = fakeMailer();

    await run(mailer);

    const message = sent.find((m) => m.to === 'broker@alpha.bg')!;
    expect(message.html).toContain('Digest task for the broker');
    expect(message.html).toContain('Добро утро');
    expect(message.html).toContain(`href="${APP_URL}/today"`);
  });

  it('records an empty digest as skipped and sends nothing for it', async () => {
    const temp = await createTempMember('empty');
    const { mailer, sent } = fakeMailer();

    const result = await run(mailer);

    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(sent.map((m) => m.to)).not.toContain(temp.email);
    expect(await deliveryFor(temp.userId)).toEqual({ status: 'skipped', error: null });
  });

  it('sends nothing to a member who turned the digest off or was deactivated', async () => {
    const off = await createTempMember('off');
    const gone = await createTempMember('gone', 'deactivated');
    const on = await createTempMember('on');
    await admin.from('profiles').update({ digest_enabled: false }).eq('id', off.userId);
    for (const member of [off, gone, on]) await createOverdueTask(member.userId, broker.agencyId, 'Temp member task');
    const { mailer, sent } = fakeMailer();

    await run(mailer);

    const recipients = sent.map((message) => message.to);
    expect(recipients).toContain(on.email);
    expect(recipients).not.toContain(off.email);
    expect(recipients).not.toContain(gone.email);
    expect(await deliveryFor(off.userId)).toBeNull();
    expect(await deliveryFor(gone.userId)).toBeNull();
  });

  it('stops the digest when a member turns it off, and brings it back when they turn it on (AC-4)', async () => {
    const member = await createTempMember('toggle');
    await createOverdueTask(member.userId, broker.agencyId, 'Temp member task');
    const profiles = new ProfileRepository(admin);

    await profiles.updateDigestEnabled(member.userId, false);
    const off = fakeMailer();
    await run(off.mailer);
    expect(off.sent.map((m) => m.to)).not.toContain(member.email);

    await profiles.updateDigestEnabled(member.userId, true);
    const on = fakeMailer();
    await run(on.mailer);
    expect(on.sent.map((m) => m.to)).toContain(member.email);
  });

  it('runs only the agencies whose local time is 08:xx on a weekday', async () => {
    await createOverdueTask(broker.userId, broker.agencyId, 'Digest task for the broker');
    const { mailer, sent } = fakeMailer();

    const saturday = await service(mailer).runDueAgencies(new Date('2031-03-08T06:10:00Z'));
    const tooEarly = await service(mailer).runDueAgencies(new Date('2031-03-10T04:10:00Z'));
    expect(saturday.due).toBe(0);
    expect(tooEarly.due).toBe(0);
    expect(sent).toEqual([]);

    const monday = await service(mailer).runDueAgencies(NOW);
    expect(monday.due).toBeGreaterThanOrEqual(2);
    expect(monday.agenciesFailed).toBe(0);
    expect(sent.map((message) => message.to)).toContain(await emailFor(broker.userId));
  });

  describe('agency counts', () => {
    let agencyId: string;
    let owner: { userId: string; email: string };
    let member: { userId: string; email: string };

    /** An agency of its own, so other suites' rows can't move the counts while this runs. */
    beforeAll(async () => {
      const stamp = Date.now();
      const { data, error } = await admin
        .from('agencies')
        .insert({ name: 'Digest counts agency', slug: `digest-counts-${stamp}` })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      agencyId = data.id;

      const addMember = async (role: 'owner' | 'broker') => {
        const email = `digest-counts-${role}-${stamp}@counts.bg`;
        const created = await admin.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
        if (created.error) throw new Error(created.error.message);
        tempUserIds.push(created.data.user.id);
        const added = await admin
          .from('agency_memberships')
          .insert({ agency_id: agencyId, user_id: created.data.user.id, role, status: 'active' });
        if (added.error) throw new Error(added.error.message);
        return { userId: created.data.user.id, email };
      };
      owner = await addMember('owner');
      member = await addMember('broker');
    });

    afterAll(async () => {
      if (agencyId) await admin.from('agencies').delete().eq('id', agencyId);
    });

    it('sends counts to an owner with no work of their own, never to a broker, matching Exceptions', async () => {
      const empty = fakeMailer();
      await run(empty.mailer, agencyId);
      expect(empty.sent).toEqual([]);
      expect(await deliveryFor(owner.userId)).toEqual({ status: 'skipped', error: null });

      // Dated in the past, so they are overdue at NOW and at the real now /exceptions reads.
      for (const title of ['One', 'Two', 'Three']) await createOverdueTask(member.userId, agencyId, title, '2020-01-01T09:00:00Z');
      const unassigned = await admin
        .from('inquiries')
        .insert([{ agency_id: agencyId, caller_name: 'A' }, { agency_id: agencyId, caller_name: 'B' }]);
      if (unassigned.error) throw new Error(unassigned.error.message);
      // Beta's row must not count here.
      await createOverdueTask(betaBroker.userId, betaBroker.agencyId, 'Beta only task', '2020-01-01T09:00:00Z');

      const { mailer, sent } = fakeMailer();
      await run(mailer, agencyId);

      const exceptions = await new ExceptionsRepository(admin).getDashboardData(agencyId, TIMEZONE);
      const overdue = exceptions.overdueTasksByBroker.reduce((sum, broker) => sum + broker.overdue_count, 0);
      expect(exceptions.unassignedInquiries).toHaveLength(2);
      expect(overdue).toBe(3);

      const ownerMail = sent.find((m) => m.to === owner.email)!;
      expect(ownerMail.text).toContain(`Невъзложени запитвания: ${exceptions.unassignedInquiries.length}`);
      expect(ownerMail.text).toContain(`Просрочени задачи: ${overdue}`);
      expect(ownerMail.html).toContain(`href="${APP_URL}/exceptions"`);

      const brokerMail = sent.find((m) => m.to === member.email)!;
      expect(brokerMail.html).toContain('One');
      expect(brokerMail.text).not.toContain('Невъзложени запитвания');
      expect(brokerMail.html).not.toContain('/exceptions');
    });
  });

  it("never puts another agency's data in a digest", async () => {
    await createOverdueTask(broker.userId, broker.agencyId, 'Alpha only task');
    await createOverdueTask(betaBroker.userId, betaBroker.agencyId, 'Beta only task');
    const { mailer, sent } = fakeMailer();

    await run(mailer, broker.agencyId);
    const alphaMail = sent.splice(0);
    await run(mailer, betaBroker.agencyId);
    const betaMail = sent.splice(0);

    expect(alphaMail.length).toBeGreaterThan(0);
    expect(betaMail.length).toBeGreaterThan(0);
    for (const message of alphaMail) {
      expect(message.html).not.toContain('Beta only task');
      expect(message.to).not.toMatch(/@beta\.bg$/);
    }
    for (const message of betaMail) {
      expect(message.html).not.toContain('Alpha only task');
      expect(message.to).not.toMatch(/@alpha\.bg$/);
    }
    expect(betaMail.find((m) => m.to === 'broker@beta.bg')!.html).toContain('Beta only task');
  });

  describe('inquiry-assigned email', () => {
    // A different date from the digest tests, so these rows have their own period keys.
    const ASSIGNED_NOW = new Date('2031-04-07T09:00:00Z');
    const ASSIGNED_DATE = '2031-04-07';

    afterAll(() => admin.from('notification_deliveries').delete().like('period_key', `%${ASSIGNED_DATE}`));

    const notify = (mailer: Mailer, assigneeId: string, inquiryId: string, callerName: string | null = 'Maria Petrova') =>
      service(mailer).notifyInquiryAssigned({
        agencyId: broker.agencyId,
        assigneeId,
        inquiryId,
        callerName,
        now: ASSIGNED_NOW,
      });

    async function deliveriesFor(userId: string) {
      const { data } = await admin
        .from('notification_deliveries')
        .select('kind, period_key, entity_id, status, provider_id, error')
        .eq('user_id', userId)
        .like('period_key', `%${ASSIGNED_DATE}`);
      return data ?? [];
    }

    it('emails the assignee and records the delivery under the inquiry and date (AC-3)', async () => {
      const member = await createTempMember('basic');
      const { mailer, sent } = fakeMailer();
      const inquiryId = randomUUID();

      await notify(mailer, member.userId, inquiryId);

      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(member.email);
      expect(sent[0].text).toContain('Maria Petrova');
      expect(sent[0].text).toContain(`${APP_URL}/inquiries`);
      expect(await deliveriesFor(member.userId)).toEqual([
        {
          kind: 'inquiry_assigned',
          period_key: `${inquiryId}:${ASSIGNED_DATE}`,
          entity_id: inquiryId,
          status: 'sent',
          provider_id: 'fake-1',
          error: null,
        },
      ]);
    });

    it('writes in the language of the assignee', async () => {
      const member = await createTempMember('english');
      await admin.from('profiles').update({ locale: 'en' }).eq('id', member.userId);
      const { mailer, sent } = fakeMailer();

      await notify(mailer, member.userId, randomUUID());

      expect(sent[0].subject).toContain('assigned to you');
    });

    it("still emails a broker's second inquiry on the same day", async () => {
      const member = await createTempMember('second');
      const { mailer, sent } = fakeMailer();

      await notify(mailer, member.userId, randomUUID());
      await notify(mailer, member.userId, randomUUID());

      expect(sent).toHaveLength(2);
    });

    it('sends one email when the same inquiry is assigned to them twice in a day (AD-051)', async () => {
      const member = await createTempMember('repeat');
      const { mailer, sent } = fakeMailer();
      const inquiryId = randomUUID();

      await notify(mailer, member.userId, inquiryId);
      await notify(mailer, member.userId, inquiryId);

      expect(sent).toHaveLength(1);
    });

    it('still emails someone who turned the digest off (AC-4)', async () => {
      const member = await createTempMember('digest-off');
      await admin.from('profiles').update({ digest_enabled: false }).eq('id', member.userId);
      const { mailer, sent } = fakeMailer();

      await notify(mailer, member.userId, randomUUID());

      expect(sent).toHaveLength(1);
    });

    it('sends nothing and records nothing for a deactivated member', async () => {
      const member = await createTempMember('deactivated', 'deactivated');
      const { mailer, sent } = fakeMailer();

      await notify(mailer, member.userId, randomUUID());

      expect(sent).toHaveLength(0);
      expect(await deliveriesFor(member.userId)).toEqual([]);
    });

    it('sends nothing to a member of another agency', async () => {
      const { mailer, sent } = fakeMailer();

      await notify(mailer, betaBroker.userId, randomUUID());

      expect(sent).toHaveLength(0);
      expect(await deliveriesFor(betaBroker.userId)).toEqual([]);
    });

    it('records a refused send as failed and does not throw', async () => {
      const member = await createTempMember('refused');
      const mailer: Mailer = { send: async () => ({ ok: false, error: 'Mailbox unavailable' }) };

      await expect(notify(mailer, member.userId, randomUUID())).resolves.toBeUndefined();

      const [delivery] = await deliveriesFor(member.userId);
      expect(delivery.status).toBe('failed');
      expect(delivery.error).toBe('Mailbox unavailable');
    });

    it('records a mailer that throws as failed and does not throw', async () => {
      const member = await createTempMember('throws');
      const mailer: Mailer = {
        send: async () => {
          throw new Error('connection refused');
        },
      };

      await expect(notify(mailer, member.userId, randomUUID())).resolves.toBeUndefined();

      const [delivery] = await deliveriesFor(member.userId);
      expect(delivery.status).toBe('failed');
    });

    it('links a conversion email to the opportunity, under the same inquiry and date key', async () => {
      const member = await createTempMember('converted');
      const { mailer, sent } = fakeMailer();
      const inquiryId = randomUUID();

      await service(mailer).notifyInquiryAssigned({
        agencyId: broker.agencyId,
        assigneeId: member.userId,
        inquiryId,
        callerName: 'Maria Petrova',
        opportunityId: 'opp-1',
        now: ASSIGNED_NOW,
      });

      expect(sent[0].text).toContain(`${APP_URL}/opportunities/opp-1`);
      const [delivery] = await deliveriesFor(member.userId);
      expect(delivery.period_key).toBe(`${inquiryId}:${ASSIGNED_DATE}`);
    });

    it('uses the translated fallback for a nameless caller', async () => {
      const member = await createTempMember('nameless');
      const { mailer, sent } = fakeMailer();

      await notify(mailer, member.userId, randomUUID(), null);

      expect(sent[0].text).toContain('Неизвестен обаждащ се');
    });
  });

  describe('import summary', () => {
    async function createImportJob(agencyId = broker.agencyId) {
      const { data, error } = await admin
        .from('import_jobs')
        .insert({
          agency_id: agencyId,
          entity_type: 'inquiry',
          status: 'completed',
          file_name: 'inquiries.csv',
          file_sha256: 'b'.repeat(64),
          file_size_bytes: 100,
          encoding: 'utf-8',
          delimiter: ',',
          headers: ['Name'],
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      cleanup.track('import_jobs', data.id);
      return data.id as string;
    }

    async function createImportedInquiries(jobId: string, assignedTo: string | null, count: number, status = 'new', agencyId = broker.agencyId) {
      const rows = Array.from({ length: count }, (_, i) => ({
        agency_id: agencyId,
        import_job_id: jobId,
        assigned_to: assignedTo,
        status,
        caller_name: `Imported ${i}`,
        ...(status === 'dismissed' ? { dismissed_reason: 'test' } : {}),
      }));
      const { data, error } = await admin.from('inquiries').insert(rows).select('id');
      if (error) throw new Error(error.message);
      for (const row of data) cleanup.track('inquiries', row.id);
    }

    const notifyImport = (mailer: Mailer, jobId: string, actorId: string) =>
      service(mailer).notifyImportCompleted({ agencyId: broker.agencyId, jobId, actorId });

    it('sends one summary per assignee with their own count', async () => {
      const first = await createTempMember('import-first');
      const second = await createTempMember('import-second');
      const jobId = await createImportJob();
      await createImportedInquiries(jobId, first.userId, 3);
      await createImportedInquiries(jobId, second.userId, 1);
      const { mailer, sent } = fakeMailer();

      await notifyImport(mailer, jobId, broker.userId);

      expect(sent).toHaveLength(2);
      expect(sent.find((m) => m.to === first.email)?.subject).toContain('3');
      expect(sent.find((m) => m.to === second.email)?.subject).toContain('1');
      const { data } = await admin.from('notification_deliveries').select('kind, period_key, entity_id, status').eq('user_id', first.userId);
      expect(data).toEqual([{ kind: 'inquiry_assigned', period_key: `import:${jobId}`, entity_id: jobId, status: 'sent' }]);
    });

    it('sends nothing to the person importing', async () => {
      const member = await createTempMember('import-self');
      const jobId = await createImportJob();
      await createImportedInquiries(jobId, member.userId, 2);
      const { mailer, sent } = fakeMailer();

      await notifyImport(mailer, jobId, member.userId);

      expect(sent).toHaveLength(0);
    });

    it('does not send twice when the final batch is retried', async () => {
      const member = await createTempMember('import-retry');
      const jobId = await createImportJob();
      await createImportedInquiries(jobId, member.userId, 2);
      const { mailer, sent } = fakeMailer();

      await notifyImport(mailer, jobId, broker.userId);
      await notifyImport(mailer, jobId, broker.userId);

      expect(sent).toHaveLength(1);
    });

    it('counts only new inquiries, as the import preview does', async () => {
      const member = await createTempMember('import-closed');
      const jobId = await createImportJob();
      await createImportedInquiries(jobId, member.userId, 2);
      await createImportedInquiries(jobId, member.userId, 4, 'contacted');
      const { mailer, sent } = fakeMailer();

      await notifyImport(mailer, jobId, broker.userId);

      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toContain('2');
    });

    it('sends nothing for a job with no inquiries, such as a contact import', async () => {
      const jobId = await createImportJob();
      const { mailer, sent } = fakeMailer();

      await notifyImport(mailer, jobId, broker.userId);

      expect(sent).toHaveLength(0);
    });

    it("never reads another agency's job", async () => {
      const jobId = await createImportJob(betaBroker.agencyId);
      await createImportedInquiries(jobId, betaBroker.userId, 2, 'new', betaBroker.agencyId);
      const { mailer, sent } = fakeMailer();

      await notifyImport(mailer, jobId, broker.userId);

      expect(sent).toHaveLength(0);
      expect(await repo.getImportAssigneeCounts(broker.agencyId, jobId)).toEqual(new Map());
    });

    it('leaves unassigned inquiries out of the counts', async () => {
      const member = await createTempMember('import-unassigned');
      const jobId = await createImportJob();
      await createImportedInquiries(jobId, member.userId, 2);
      await createImportedInquiries(jobId, null, 3);

      expect(await repo.getImportAssigneeCounts(broker.agencyId, jobId)).toEqual(new Map([[member.userId, 2]]));
    });

    it("carries on after one assignee's email fails", async () => {
      const failing = await createTempMember('import-fail');
      const working = await createTempMember('import-work');
      const jobId = await createImportJob();
      await createImportedInquiries(jobId, failing.userId, 1);
      await createImportedInquiries(jobId, working.userId, 1);
      const { mailer, sent } = fakeMailer(failing.email);

      await expect(notifyImport(mailer, jobId, broker.userId)).resolves.toBeUndefined();

      expect(sent.map((m) => m.to)).toEqual([working.email]);
    });
  });
});
