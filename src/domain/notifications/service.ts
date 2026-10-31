import { agencyDateKey, getTodayWindows, isDigestTime } from '@/lib/time/agency-day';
import { buildDigest } from './digest-builder';
import type { MailResult, Mailer } from './mailer';
import type { NotificationRepository } from './repository';
import { renderDailyDigest, renderImportSummary, renderInquiryAssigned, type RenderedEmail } from './templates';
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

/** What a cron call did: the agencies it looked at, the ones whose 08:xx it was, and the sends. */
export type CronRunResult = DigestRunResult & { agencies: number; due: number; agenciesFailed: number };

type RunDigestInput = { agencyId: string; timezone: string; now: Date };

type InquiryAssignedInput = {
  agencyId: string;
  assigneeId: string;
  inquiryId: string;
  callerName: string | null;
  /** Set when a conversion made them the owner. The key stays the inquiry and date (AD-051). */
  opportunityId?: string;
  now?: Date;
};

/**
 * Who an assignment change should email (rule 4): the new assignee, unless nothing changed,
 * the inquiry was unassigned, or they did it themself.
 */
export function assigneeToNotify({
  previous,
  next,
  actorId,
}: {
  previous: string | null | undefined;
  next: string | null | undefined;
  actorId: string;
}): string | null {
  if (!next || next === previous || next === actorId) return null;
  return next;
}

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

  /** Runs the digest for every agency whose local time is 08:xx on a weekday. One agency failing doesn't stop the rest. */
  async runDueAgencies(now: Date): Promise<CronRunResult> {
    const agencies = await this.repo.listAgencies();
    let total = emptyRunResult();
    let due = 0;
    let agenciesFailed = 0;
    for (const agency of agencies) {
      if (!isDigestTime(agency.timezone, now)) continue;
      due++;
      try {
        total = addRunResults(total, await this.runDailyDigest({ agencyId: agency.id, timezone: agency.timezone, now }));
      } catch (error) {
        agenciesFailed++;
        console.error(`Daily digest failed for agency ${agency.id}:`, error);
      }
    }
    return { ...total, agencies: agencies.length, due, agenciesFailed };
  }

  /** Emails the assignee of an inquiry (rule 4). `notifyAfterResponse` catches anything that throws here. */
  async notifyInquiryAssigned({ agencyId, assigneeId, inquiryId, callerName, opportunityId, now = new Date() }: InquiryAssignedInput): Promise<void> {
    const timezone = await this.repo.getTimezone(agencyId);
    await this.sendAssignmentEmail({
      agencyId,
      userId: assigneeId,
      periodKey: `${inquiryId}:${agencyDateKey(timezone, now)}`,
      entityId: inquiryId,
      render: (recipient) =>
        renderInquiryAssigned({ recipientName: recipient.name, callerName, locale: recipient.locale, appUrl: this.appUrl, opportunityId }),
    });
  }

  /**
   * After an import, sends each assignee other than the person importing one summary (rule 4).
   * One assignee's failure doesn't stop the others. `notifyAfterResponse` catches anything else.
   */
  async notifyImportCompleted({ agencyId, jobId, actorId }: { agencyId: string; jobId: string; actorId: string }): Promise<void> {
    const counts = await this.repo.getImportAssigneeCounts(agencyId, jobId);
    for (const [userId, count] of counts) {
      if (userId === actorId) continue;
      try {
        await this.sendAssignmentEmail({
          agencyId,
          userId,
          periodKey: `import:${jobId}`,
          entityId: jobId,
          render: (recipient) =>
            renderImportSummary({ recipientName: recipient.name, count, locale: recipient.locale, appUrl: this.appUrl }),
        });
      } catch (error) {
        console.error(`Import summary failed for user ${userId} in agency ${agencyId}:`, error);
      }
    }
  }

  /** Claims the key, sends and records the result (AD-051). A member who isn't active in the agency gets no email and no row. */
  private async sendAssignmentEmail({
    agencyId,
    userId,
    periodKey,
    entityId,
    render,
  }: {
    agencyId: string;
    userId: string;
    periodKey: string;
    entityId: string;
    render: (recipient: DigestRecipient) => RenderedEmail;
  }): Promise<void> {
    const recipient = await this.repo.getActiveRecipient(agencyId, userId);
    if (!recipient) return;

    const deliveryId = await this.repo.claim(agencyId, userId, { kind: 'inquiry_assigned', periodKey, entityId });
    if (!deliveryId) return;

    let sent: MailResult;
    try {
      sent = await this.mailer.send({ to: recipient.email, ...render(recipient) });
    } catch (error) {
      console.error(`Assignment email failed for user ${userId} in agency ${agencyId}:`, error);
      sent = { ok: false, error: 'Unexpected error before the email was confirmed sent' };
    }
    await this.repo.settle(
      agencyId,
      deliveryId,
      sent.ok ? { status: 'sent', providerId: sent.providerId } : { status: 'failed', error: sent.error },
    );
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

      const digest = buildDigest({ userId: recipient.userId, role: recipient.role, tasks, inquiries, timezone, now });
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
