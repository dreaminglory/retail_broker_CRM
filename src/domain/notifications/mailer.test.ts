import { describe, expect, it, vi } from 'vitest';
import { describeServices } from '@/test/supabase-test-client';
import { createMailer, createResendMailer, createSmtpMailer } from './mailer';

const message = { to: 'broker@alpha.bg', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createMailer', () => {
  it('fails clearly when MAIL_TRANSPORT is missing', () => {
    expect(() => createMailer({})).toThrow(/MAIL_TRANSPORT is not set/);
  });

  it('fails clearly when MAIL_TRANSPORT is unknown', () => {
    expect(() => createMailer({ MAIL_TRANSPORT: 'sendgrid' })).toThrow(/Unknown MAIL_TRANSPORT "sendgrid"/);
  });

  it('asks for the settings a transport needs', () => {
    expect(() => createMailer({ MAIL_TRANSPORT: 'resend', EMAIL_FROM: 'a@b.bg' })).toThrow(/RESEND_API_KEY/);
    expect(() => createMailer({ MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k' })).toThrow(/EMAIL_FROM/);
    expect(() => createMailer({ MAIL_TRANSPORT: 'smtp' })).toThrow(/EMAIL_FROM/);
  });

  it('builds a mailer for each known transport', () => {
    expect(createMailer({ MAIL_TRANSPORT: 'smtp', EMAIL_FROM: 'a@b.bg' }).send).toBeTypeOf('function');
    expect(createMailer({ MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.bg' }).send).toBeTypeOf(
      'function',
    );
  });
});

describe('createResendMailer', () => {
  const sleep = vi.fn(async () => {});

  it('posts the message to Resend and returns the provider id', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'em_123' }));
    const mailer = createResendMailer({ apiKey: 'key', from: 'BrokerCRM <no-reply@x.bg>', fetchImpl, sleep });

    expect(await mailer.send(message)).toEqual({ ok: true, providerId: 'em_123' });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key');
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'BrokerCRM <no-reply@x.bg>',
      to: ['broker@alpha.bg'],
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it("returns the provider's message when it refuses", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'Domain is not verified' }, 403));
    const mailer = createResendMailer({ apiKey: 'key', from: 'a@b.bg', fetchImpl, sleep });

    expect(await mailer.send(message)).toEqual({ ok: false, error: 'Domain is not verified' });
  });

  it('falls back to the status code when the body is not JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    const mailer = createResendMailer({ apiKey: 'key', from: 'a@b.bg', fetchImpl, sleep });

    expect(await mailer.send(message)).toEqual({ ok: false, error: 'Resend responded with 502' });
  });

  it('reports a network failure as a result, not a throw', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const mailer = createResendMailer({ apiKey: 'key', from: 'a@b.bg', fetchImpl, sleep });

    expect(await mailer.send(message)).toEqual({ ok: false, error: 'socket hang up' });
  });

  it('waits between sends, including concurrent ones', async () => {
    const waits: number[] = [];
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'em' }));
    const mailer = createResendMailer({
      apiKey: 'key',
      from: 'a@b.bg',
      fetchImpl,
      minIntervalMs: 10_000,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    await Promise.all([mailer.send(message), mailer.send(message), mailer.send(message)]);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(waits).toHaveLength(2);
    expect(waits.every((ms) => ms > 0 && ms <= 10_000)).toBe(true);
  });
});

describe('createSmtpMailer', () => {
  it('reports an unreachable server as a result, not a throw', async () => {
    const mailer = createSmtpMailer({ host: '127.0.0.1', port: 1, from: 'a@b.bg' });

    const result = await mailer.send(message);

    expect(result.ok).toBe(false);
  });
});

// Needs the local stack, which starts Mailpit; its web UI is on :54324.
describeServices('createSmtpMailer against Mailpit', () => {
  it('delivers a message that appears in Mailpit', async () => {
    const subject = `Mailer test ${Date.now()}`;
    const mailer = createMailer({ MAIL_TRANSPORT: 'smtp', EMAIL_FROM: 'BrokerCRM <no-reply@brokercrm.local>' });

    const result = await mailer.send({ ...message, subject });
    expect(result.ok).toBe(true);

    const response = await fetch('http://127.0.0.1:54324/api/v1/search?query=' + encodeURIComponent(`subject:"${subject}"`));
    const body = (await response.json()) as { messages?: { Subject: string; To: { Address: string }[] }[] };
    expect(body.messages?.[0]?.Subject).toBe(subject);
    expect(body.messages?.[0]?.To[0]?.Address).toBe('broker@alpha.bg');
  });
});
