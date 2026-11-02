import nodemailer from 'nodemailer';

/**
 * Outbound email (AD-042). `MAIL_TRANSPORT` picks the adapter: `smtp` sends to the local
 * Mailpit, `resend` calls Resend's HTTP API. Both report a failure as a value, never a throw,
 * so one bad recipient can't stop a run.
 */
export type MailMessage = { to: string; subject: string; html: string; text: string };

export type MailResult = { ok: true; providerId: string | null } | { ok: false; error: string };

export type Mailer = { send(message: MailMessage): Promise<MailResult> };

type Env = Record<string, string | undefined>;

const DEFAULT_SMTP_HOST = '127.0.0.1';
const DEFAULT_SMTP_PORT = 54325;
const RESEND_URL = 'https://api.resend.com/emails';
/** Resend allows 2 requests a second; a little over half a second between sends stays under it. */
const RESEND_MIN_INTERVAL_MS = 600;

function required(env: Env, name: string, transport: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required when MAIL_TRANSPORT=${transport}.`);
  return value;
}

function failure(error: unknown): MailResult {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export function createSmtpMailer(options: { host: string; port: number; from: string }): Mailer {
  const transporter = nodemailer.createTransport({ host: options.host, port: options.port, secure: false, ignoreTLS: true });
  return {
    async send(message) {
      try {
        const info = await transporter.sendMail({ from: options.from, ...message });
        return { ok: true, providerId: info.messageId ?? null };
      } catch (error) {
        return failure(error);
      }
    },
  };
}

type ResendOptions = {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  minIntervalMs?: number;
};

export function createResendMailer(options: ResendOptions): Mailer {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const minIntervalMs = options.minIntervalMs ?? RESEND_MIN_INTERVAL_MS;
  let lastSentAt: number | null = null;
  // Calls queue behind each other so concurrent sends are still paced.
  let queue: Promise<unknown> = Promise.resolve();

  async function deliver(message: MailMessage): Promise<MailResult> {
    if (lastSentAt !== null) {
      const wait = minIntervalMs - (Date.now() - lastSentAt);
      if (wait > 0) await sleep(wait);
    }
    lastSentAt = Date.now();
    try {
      const response = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!response.ok) return { ok: false, error: body?.message ?? `Resend responded with ${response.status}` };
      return { ok: true, providerId: body?.id ?? null };
    } catch (error) {
      return failure(error);
    }
  }

  return {
    send(message) {
      const result = queue.then(() => deliver(message));
      queue = result;
      return result;
    },
  };
}

/** The mailer `MAIL_TRANSPORT` names. A missing or unknown value is a configuration error. */
export function createMailer(env: Env = process.env): Mailer {
  const transport = env.MAIL_TRANSPORT;
  if (transport === 'smtp') {
    return createSmtpMailer({
      host: env.SMTP_HOST || DEFAULT_SMTP_HOST,
      port: Number(env.SMTP_PORT) || DEFAULT_SMTP_PORT,
      from: required(env, 'EMAIL_FROM', transport),
    });
  }
  if (transport === 'resend') {
    return createResendMailer({
      apiKey: required(env, 'RESEND_API_KEY', transport),
      from: required(env, 'EMAIL_FROM', transport),
    });
  }
  throw new Error(
    transport
      ? `Unknown MAIL_TRANSPORT "${transport}". Use "smtp" (local Mailpit) or "resend".`
      : 'MAIL_TRANSPORT is not set. Use "smtp" (local Mailpit) or "resend".',
  );
}
