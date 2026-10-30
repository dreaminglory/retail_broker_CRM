import { agencyDateKey, getTodayWindows } from '@/lib/time/agency-day';
import { buildDigest } from './digest-builder';
import type { Mailer } from './mailer';
import type { NotificationRepository } from './repository';
import { renderDailyDigest } from './templates';
import type { DigestInquiryInput, DigestRecipient, DigestTaskInput } from './types';

/** What one agency's run did, per recipient. `alreadyDone` held a `sent` or `pending` row. */
export type DigestRunResult = { sent: number; failed: number; skipped: number; alreadyDone: number };

export const emptyRunResult = (): DigestRunResult => ({ sent: 0, failed: 0, skipped: 0, alreadyDone: 0 });

export function addRunResults(a: DigestRunResult, b: DigestRunResult): DigestRunResult {
  return {
    sent: a.sent + b.sent,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
    alreadyDone: a.alreadyDone + b.alreadyDone,
  };
}

type RunDigestInput = { agencyId: string; timezone: string; now: Date };

/**
 * Sends the daily digest (AD-042). Safe to run again: each recipient's send is claimed first
 * (AD-051), so a second or concurrent run skips whoever is already sent or in flight and
 * retries whoever failed.
 */
export class NotificationService {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly mailer: Mailer,
    private readonly appUrl: string,
  ) {}

  async runDailyDigest({ agencyId, timezone, now }: RunDigestInput): Promise<DigestRunResult> {
    const result = emptyRunResult();
    const recipients = await this.repo.getDigestRecipients(agencyId);
    if (recipients.length === 0) return result;

    const { dueToday } = getTodayWindows(timezone, now);
    const [tasks, inquiries] = await Promise.all([
      this.repo.getTasksDueBefore(agencyId, dueToday.before),
      this.repo.getNewInquiries(agencyId),
    ]);
    const periodKey = agencyDateKey(timezone, now);

    for (const recipient of recipients) {
      const outcome = await this.sendDigest(recipient, { agencyId, timezone, now, periodKey, tasks, inquiries });
      result[outcome]++;
    }
    return result;
  }

  private async sendDigest(
    recipient: DigestRecipient,
    context: {
      agencyId: string;
      timezone: string;
      now: Date;
      periodKey: string;
      tasks: DigestTaskInput[];
      inquiries: DigestInquiryInput[];
    },
  ): Promise<keyof DigestRunResult> {
    const { agencyId, timezone, now, periodKey, tasks, inquiries } = context;
    let deliveryId: string | null = null;
    let emailSent = false;
    try {
      deliveryId = await this.repo.claim(agencyId, recipient.userId, { kind: 'daily_digest', periodKey });
      if (!deliveryId) return 'alreadyDone';

      const digest = buildDigest({ userId: recipient.userId, tasks, inquiries, timezone, now });
      if (!digest) {
        await this.repo.settle(agencyId, deliveryId, { status: 'skipped' });
        return 'skipped';
      }

      const email = renderDailyDigest({
        digest,
        recipientName: recipient.name,
        locale: recipient.locale,
        timezone,
        appUrl: this.appUrl,
      });
      const sent = await this.mailer.send({ to: recipient.email, ...email });
      if (sent.ok) {
        emailSent = true;
        await this.repo.settle(agencyId, deliveryId, { status: 'sent', providerId: sent.providerId });
        return 'sent';
      }
      await this.repo.settle(agencyId, deliveryId, { status: 'failed', error: sent.error });
      return 'failed';
    } catch (error) {
      // One recipient's problem never stops the others. The row, if we hold one, goes to
      // 'failed' so the next run retries it; the log carries ids, never addresses.
      console.error(`Daily digest failed for user ${recipient.userId} in agency ${agencyId}:`, error);
      // If the email already went out, the row stays 'pending'. That blocks a repeat, so the
      // user gets no second copy.
      if (emailSent) return 'sent';
      if (deliveryId) {
        await this.repo
          .settle(agencyId, deliveryId, { status: 'failed', error: 'Unexpected error before the email was confirmed sent' })
          .catch(() => {});
      }
      return 'failed';
    }
  }
}
