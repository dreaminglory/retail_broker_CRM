import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
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
  const admin = adminClient();
  const cleanup = createRowCleanup();
  const repo = new NotificationRepository(admin);
  let broker: TestSession;
  let manager: TestSession;
  let betaBroker: TestSession;

  beforeAll(async () => {
    [broker, manager, betaBroker] = await Promise.all([
      signInAs('broker@alpha.bg'),
      signInAs('manager@alpha.bg'),
      signInAs('broker@beta.bg'),
    ]);
  });

  beforeEach(async () => {
    await admin.from('notification_deliveries').delete().eq('period_key', PERIOD_KEY);
  });

  afterAll(async () => {
    await admin.from('notification_deliveries').delete().eq('period_key', PERIOD_KEY);
    await cleanup.run();
  });

  async function createOverdueTask(session: TestSession, title: string) {
    const { data, error } = await admin
      .from('tasks')
      .insert({
        agency_id: session.agencyId,
        title,
        due_at: '2031-03-09T09:00:00Z',
        assigned_to: session.userId,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.track('tasks', data.id);
  }

  function service(mailer: Mailer) {
    return new NotificationService(repo, mailer, APP_URL);
  }

  const run = (mailer: Mailer, agencyId = broker.agencyId) =>
    service(mailer).runDailyDigest({ agencyId, timezone: TIMEZONE, now: NOW });

  async function emailFor(userId: string): Promise<string> {
    const { data } = await admin.from('profiles').select('email').eq('id', userId).single();
    return data!.email;
  }

  async function deliveryStatuses(agencyId: string): Promise<string[]> {
    const { data } = await admin
      .from('notification_deliveries')
      .select('status')
      .eq('agency_id', agencyId)
      .eq('period_key', PERIOD_KEY);
    return (data ?? []).map((row) => row.status).sort();
  }

  it('sends one digest per user however many times it runs', async () => {
    await createOverdueTask(broker, 'Digest task for the broker');
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
    await createOverdueTask(broker, 'Digest task for the broker');
    const { mailer, sent } = fakeMailer();

    await Promise.all([run(mailer), run(mailer), run(mailer)]);

    const recipients = sent.map((message) => message.to);
    expect(recipients.length).toBeGreaterThanOrEqual(1);
    expect(new Set(recipients).size).toBe(recipients.length);
  });

  it('records a failed send, carries on with the others, and retries it next run', async () => {
    await createOverdueTask(broker, 'Digest task for the broker');
    await createOverdueTask(manager, 'Digest task for the manager');
    const brokerEmail = await emailFor(broker.userId);

    const failing = fakeMailer(brokerEmail);
    const first = await run(failing.mailer);

    expect(first.failed).toBe(1);
    expect(failing.sent.map((m) => m.to)).toContain(await emailFor(manager.userId));
    expect(failing.sent.map((m) => m.to)).not.toContain(brokerEmail);
    const { data: failedRow } = await admin
      .from('notification_deliveries')
      .select('status, error')
      .eq('user_id', broker.userId)
      .eq('period_key', PERIOD_KEY)
      .single();
    expect(failedRow).toEqual({ status: 'failed', error: 'Mailbox unavailable' });

    const working = fakeMailer();
    const second = await run(working.mailer);

    expect(second.sent).toBe(1);
    expect(working.sent.map((m) => m.to)).toEqual([brokerEmail]);
    const { data: retried } = await admin
      .from('notification_deliveries')
      .select('status, error')
      .eq('user_id', broker.userId)
      .eq('period_key', PERIOD_KEY)
      .single();
    expect(retried).toEqual({ status: 'sent', error: null });
  });

  it('writes the recipient\'s own language and links to Today', async () => {
    await createOverdueTask(broker, 'Digest task for the broker');
    const { mailer, sent } = fakeMailer();

    await run(mailer);

    const message = sent.find((m) => m.to === 'broker@alpha.bg')!;
    expect(message.html).toContain('Digest task for the broker');
    expect(message.html).toContain('Добро утро');
    expect(message.html).toContain(`href="${APP_URL}/today"`);
  });

  it('records an empty digest as skipped and sends nothing', async () => {
    const { mailer, sent } = fakeMailer();

    // Whoever has nothing for the day is recorded as skipped, and gets no mail.
    const result = await run(mailer, betaBroker.agencyId);

    expect(sent).toHaveLength(result.sent);
    const statuses = await deliveryStatuses(betaBroker.agencyId);
    expect(statuses.filter((status) => status === 'skipped')).toHaveLength(result.skipped);
    for (const message of sent) expect(message.html).not.toContain('Digest task for the broker');
  });

  it('sends nothing to a member who turned the digest off or was deactivated', async () => {
    await createOverdueTask(broker, 'Digest task for the broker');
    await createOverdueTask(manager, 'Digest task for the manager');
    const brokerEmail = await emailFor(broker.userId);
    const managerEmail = await emailFor(manager.userId);

    await admin.from('profiles').update({ digest_enabled: false }).eq('id', broker.userId);
    await admin
      .from('agency_memberships')
      .update({ status: 'deactivated' })
      .eq('user_id', manager.userId)
      .eq('agency_id', manager.agencyId);
    try {
      const { mailer, sent } = fakeMailer();
      await run(mailer);

      const recipients = sent.map((message) => message.to);
      expect(recipients).not.toContain(brokerEmail);
      expect(recipients).not.toContain(managerEmail);
      const { data: rows } = await admin
        .from('notification_deliveries')
        .select('user_id')
        .eq('period_key', PERIOD_KEY)
        .in('user_id', [broker.userId, manager.userId]);
      expect(rows).toEqual([]);
    } finally {
      await admin.from('profiles').update({ digest_enabled: true }).eq('id', broker.userId);
      await admin
        .from('agency_memberships')
        .update({ status: 'active' })
        .eq('user_id', manager.userId)
        .eq('agency_id', manager.agencyId);
    }
  });

  it('never puts another agency\'s data in a digest', async () => {
    await createOverdueTask(broker, 'Alpha only task');
    await createOverdueTask(betaBroker, 'Beta only task');
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
});
