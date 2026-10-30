import type { SupabaseClient } from '@supabase/supabase-js';
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

  async function createOverdueTask(userId: string, agencyId: string, title: string) {
    const { data, error } = await admin
      .from('tasks')
      .insert({ agency_id: agencyId, title, due_at: '2031-03-09T09:00:00Z', assigned_to: userId, status: 'pending' })
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
});
