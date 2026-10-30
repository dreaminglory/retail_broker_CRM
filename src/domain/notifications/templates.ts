import { createFormatter, createTranslator } from 'next-intl';
import bg from '../../../messages/bg.json';
import en from '../../../messages/en.json';
import type { Digest, DigestInquiryRow, DigestSection, DigestTaskRow, NotificationLocale } from './types';

/**
 * Email templates (AD-042). A digest renders to subject, HTML and plain text in the recipient's
 * locale, with times in the agency's timezone. Every interpolated value is HTML-escaped, and the
 * input types hold names and task titles only, so a phone, note or inquiry subject can't appear.
 */
export type RenderedEmail = { subject: string; html: string; text: string };

const MESSAGES = { bg, en };

type RenderDigestInput = {
  digest: Digest;
  recipientName: string;
  locale: NotificationLocale;
  timezone: string;
  appUrl: string;
};

const DATE_TIME = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
const TIME = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function link(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, '')}${path}`;
}

function sectionTotal(section: DigestSection<unknown>): number {
  return section.rows.length + section.more;
}

type SectionView = { title: string; section: DigestSection<unknown>; lines: string[] };

export function renderDailyDigest({ digest, recipientName, locale, timezone, appUrl }: RenderDigestInput): RenderedEmail {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'notifications' });
  const format = createFormatter({ locale, timeZone: timezone });
  const total = sectionTotal(digest.overdue) + sectionTotal(digest.dueToday) + sectionTotal(digest.newInquiries);
  const todayUrl = link(appUrl, '/today');

  const taskLine = (row: DigestTaskRow, withDate: boolean) =>
    `${row.title} — ${format.dateTime(new Date(row.dueAt), withDate ? DATE_TIME : TIME)}`;
  const inquiryLine = (row: DigestInquiryRow) => row.callerName?.trim() || t('unknownCaller');
  const more = (count: number) => t('digest.more', { count });

  const views: SectionView[] = [
    {
      title: t('digest.overdue', { count: sectionTotal(digest.overdue) }),
      section: digest.overdue,
      lines: digest.overdue.rows.map((row) => taskLine(row, true)),
    },
    {
      title: t('digest.dueToday', { count: sectionTotal(digest.dueToday) }),
      section: digest.dueToday,
      lines: digest.dueToday.rows.map((row) => taskLine(row, false)),
    },
    {
      title: t('digest.newInquiries', { count: sectionTotal(digest.newInquiries) }),
      section: digest.newInquiries,
      lines: digest.newInquiries.rows.map(inquiryLine),
    },
  ].filter(({ section }) => sectionTotal(section) > 0);

  const greeting = t('digest.greeting', { name: recipientName });

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:560px">`,
    `<p style="font-size:18px;font-weight:bold;margin:0 0 8px">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 16px">${escapeHtml(t('digest.intro'))}</p>`,
    ...views.flatMap(({ title, section, lines }) => [
      `<p style="font-weight:bold;margin:16px 0 4px">${escapeHtml(title)}</p>`,
      `<ul style="margin:0;padding-left:20px">`,
      ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
      ...(section.more > 0 ? [`<li style="color:#666666">${escapeHtml(more(section.more))}</li>`] : []),
      `</ul>`,
    ]),
    `<p style="margin:24px 0"><a href="${escapeHtml(todayUrl)}" style="background:#1a1a1a;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(t('digest.open'))}</a></p>`,
    `<p style="font-size:12px;color:#666666">${escapeHtml(t('digest.footer'))}</p>`,
    `</div>`,
  ].join('\n');

  const text = [
    greeting,
    '',
    t('digest.intro'),
    ...views.flatMap(({ title, section, lines }) => [
      '',
      title,
      ...lines.map((line) => `- ${line}`),
      ...(section.more > 0 ? [`- ${more(section.more)}`] : []),
    ]),
    '',
    `${t('digest.open')}: ${todayUrl}`,
    '',
    t('digest.footer'),
  ].join('\n');

  return { subject: t('digest.subject', { count: total }), html, text };
}
