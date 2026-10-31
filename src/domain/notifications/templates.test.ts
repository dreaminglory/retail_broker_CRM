import { describe, expect, it } from 'vitest';
import { renderDailyDigest, renderImportSummary, renderInquiryAssigned } from './templates';
import type { Digest } from './types';

const digest: Digest = {
  overdue: { rows: [{ id: 't1', title: 'Call Ivan about the offer', dueAt: '2026-01-09T09:00:00Z' }], more: 0 },
  dueToday: { rows: [{ id: 't2', title: 'Viewing on Vitosha', dueAt: '2026-01-12T12:30:00Z' }], more: 2 },
  newInquiries: { rows: [{ id: 'i1', callerName: 'Maria Petrova' }, { id: 'i2', callerName: null }], more: 0 },
  agency: null,
};

const base = { digest, recipientName: 'Georgi', timezone: 'Europe/Sofia', appUrl: 'https://crm.example.bg/' };

describe('renderDailyDigest', () => {
  it('renders in Bulgarian with times in agency time', () => {
    const { subject, html, text } = renderDailyDigest({ ...base, locale: 'bg' });

    expect(subject).toBe('6 неща за внимание днес');
    expect(html).toContain('Добро утро, Georgi!');
    expect(html).toContain('Просрочени задачи (1)');
    expect(html).toContain('За днес (3)');
    expect(html).toContain('Нови запитвания (2)');
    expect(html).toContain('+2 още');
    expect(html).toContain('Неизвестен обаждащ се');
    // 12:30Z is 14:30 in Sofia (UTC+2), and 09:00Z is 11:00.
    expect(text).toContain('Viewing on Vitosha — 14:30');
    expect(text).toMatch(/Call Ivan about the offer — 9.01, 11:00/);
  });

  it('renders the same digest in English', () => {
    const { subject, html, text } = renderDailyDigest({ ...base, locale: 'en' });

    expect(subject).toBe('6 things need your attention today');
    expect(html).toContain('Good morning, Georgi!');
    expect(html).toContain('Overdue tasks (1)');
    expect(html).toContain('+2 more');
    expect(html).toContain('Unknown caller');
    expect(text).toContain('Viewing on Vitosha — 14:30');
    expect(text).toMatch(/Call Ivan about the offer — Jan 9,? (at )?11:00/);
  });

  it('uses the singular subject for one item', () => {
    const one: Digest = {
      overdue: { rows: [], more: 0 },
      dueToday: { rows: [{ id: 't', title: 'Only one', dueAt: '2026-01-12T12:30:00Z' }], more: 0 },
      newInquiries: { rows: [], more: 0 },
      agency: null,
    };

    expect(renderDailyDigest({ ...base, digest: one, locale: 'en' }).subject).toBe('1 thing needs your attention today');
    expect(renderDailyDigest({ ...base, digest: one, locale: 'bg' }).subject).toBe('1 нещо за внимание днес');
  });

  it('leaves out an empty section', () => {
    const { html } = renderDailyDigest({ ...base, locale: 'en', digest: { ...digest, overdue: { rows: [], more: 0 } } });

    expect(html).not.toContain('Overdue tasks');
    expect(html).toContain('Due today (3)');
  });

  it('links to Today on the app URL, with no double slash', () => {
    const { html, text } = renderDailyDigest({ ...base, locale: 'bg' });

    expect(html).toContain('href="https://crm.example.bg/today"');
    expect(text).toContain('https://crm.example.bg/today');
  });

  it('escapes task titles, caller names and the recipient name', () => {
    const hostile: Digest = {
      overdue: { rows: [{ id: 't', title: '<script>alert("x")</script>', dueAt: '2026-01-09T09:00:00Z' }], more: 0 },
      dueToday: { rows: [], more: 0 },
      newInquiries: { rows: [{ id: 'i', callerName: '<img src=x onerror=1>' }], more: 0 },
      agency: null,
    };
    const { html, subject } = renderDailyDigest({ ...base, digest: hostile, recipientName: '<b>Eve</b>', locale: 'en' });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Eve</b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(subject).not.toMatch(/[<>]/);
  });

  describe('agency counts', () => {
    const withCounts: Digest = { ...digest, agency: { unassignedInquiries: 2, overdueTasks: 5 } };
    const countsOnly: Digest = {
      overdue: { rows: [], more: 0 },
      dueToday: { rows: [], more: 0 },
      newInquiries: { rows: [], more: 0 },
      agency: { unassignedInquiries: 2, overdueTasks: 5 },
    };

    it('shows the counts and links to Exceptions, in both languages', () => {
      const en = renderDailyDigest({ ...base, digest: withCounts, locale: 'en' });
      expect(en.html).toContain('Your agency');
      expect(en.html).toContain('Unassigned inquiries: 2');
      expect(en.text).toContain('Overdue tasks: 5');
      expect(en.html).toContain('href="https://crm.example.bg/exceptions"');
      expect(en.text).toContain('https://crm.example.bg/exceptions');

      const bg = renderDailyDigest({ ...base, digest: withCounts, locale: 'bg' });
      expect(bg.html).toContain('Вашата агенция');
      expect(bg.html).toContain('Невъзложени запитвания: 2');
      expect(bg.text).toContain('Просрочени задачи: 5');
    });

    it('leaves out a count of zero', () => {
      const { html } = renderDailyDigest({
        ...base,
        digest: { ...digest, agency: { unassignedInquiries: 0, overdueTasks: 5 } },
        locale: 'en',
      });

      expect(html).not.toContain('Unassigned inquiries');
      expect(html).toContain('Overdue tasks: 5');

      const noOverdue = renderDailyDigest({
        ...base,
        digest: { ...digest, agency: { unassignedInquiries: 2, overdueTasks: 0 } },
        locale: 'en',
      });

      expect(noOverdue.html).toContain('Unassigned inquiries: 2');
      expect(noOverdue.html).not.toContain('Overdue tasks: 0');
      expect(noOverdue.text).not.toContain('Overdue tasks: 0');
    });

    it('shows no agency block and no Exceptions link without counts', () => {
      const { html, text } = renderDailyDigest({ ...base, locale: 'en' });

      expect(html).not.toContain('Your agency');
      expect(html).not.toContain('/exceptions');
      expect(text).not.toContain('/exceptions');
    });

    it('counts own work in the subject, since an own overdue task is also in the agency count', () => {
      expect(renderDailyDigest({ ...base, digest: withCounts, locale: 'en' }).subject).toBe('6 things need your attention today');
    });

    it('counts the agency in the subject when there is no own work', () => {
      expect(renderDailyDigest({ ...base, digest: countsOnly, locale: 'en' }).subject).toBe('7 things need your attention today');
    });
  });

  it('shows nothing but the names and titles it was given', () => {
    // The builder's types have no phone, note or subject field; this guards the template's own copy.
    const { html, text } = renderDailyDigest({ ...base, locale: 'en' });

    for (const out of [html, text]) {
      expect(out).not.toMatch(/\+359|0888/);
    }
  });
});

describe('renderInquiryAssigned', () => {
  const assigned = { recipientName: 'Georgi', callerName: 'Maria Petrova', appUrl: 'https://crm.example.bg/' };

  it('renders in Bulgarian and links to the inquiries', () => {
    const { subject, html, text } = renderInquiryAssigned({ ...assigned, locale: 'bg' });

    expect(subject).toBe('Ново запитване за вас: Maria Petrova');
    expect(html).toContain('Здравейте, Georgi!');
    expect(html).toContain('https://crm.example.bg/inquiries');
    expect(text).toContain('Запитването от Maria Petrova е възложено на вас.');
  });

  it('renders the same email in English', () => {
    const { subject, text } = renderInquiryAssigned({ ...assigned, locale: 'en' });

    expect(subject).toBe('New inquiry assigned to you: Maria Petrova');
    expect(text).toContain('The inquiry from Maria Petrova was assigned to you.');
    expect(text).toContain('https://crm.example.bg/inquiries');
  });

  it('falls back to a translated name for a nameless caller', () => {
    const { subject } = renderInquiryAssigned({ ...assigned, callerName: '  ', locale: 'en' });

    expect(subject).toBe('New inquiry assigned to you: Unknown caller');
  });

  it('escapes the names in the HTML', () => {
    const { html } = renderInquiryAssigned({ ...assigned, callerName: '<script>x</script>', recipientName: '<b>G</b>', locale: 'en' });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>G');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderInquiryAssigned for a conversion', () => {
  const converted = {
    recipientName: 'Georgi',
    callerName: 'Maria Petrova',
    appUrl: 'https://crm.example.bg',
    opportunityId: 'opp-1',
  };

  it('renders in Bulgarian and links to the opportunity', () => {
    const { subject, text } = renderInquiryAssigned({ ...converted, locale: 'bg' });

    expect(subject).toBe('Нова сделка за вас: Maria Petrova');
    expect(text).toContain('Сделката по запитването от Maria Petrova е възложена на вас.');
    expect(text).toContain('https://crm.example.bg/opportunities/opp-1');
  });

  it('renders the same email in English', () => {
    const { subject, text } = renderInquiryAssigned({ ...converted, locale: 'en' });

    expect(subject).toBe('New opportunity assigned to you: Maria Petrova');
    expect(text).toContain('The opportunity from the inquiry by Maria Petrova was assigned to you.');
    expect(text).toContain('https://crm.example.bg/opportunities/opp-1');
  });
});

describe('renderImportSummary', () => {
  const summary = { recipientName: 'Georgi', appUrl: 'https://crm.example.bg/' };

  it('renders the count in Bulgarian and links to the inquiries', () => {
    const { subject, text } = renderImportSummary({ ...summary, count: 12, locale: 'bg' });

    expect(subject).toBe('12 нови запитвания за вас');
    expect(text).toContain('12 внесени запитвания са възложени на вас.');
    expect(text).toContain('https://crm.example.bg/inquiries');
  });

  it('renders the count in English', () => {
    const { subject, text } = renderImportSummary({ ...summary, count: 12, locale: 'en' });

    expect(subject).toBe('12 new inquiries assigned to you');
    expect(text).toContain('12 imported inquiries were assigned to you.');
  });

  it('uses the singular for one inquiry', () => {
    expect(renderImportSummary({ ...summary, count: 1, locale: 'en' }).subject).toBe('1 new inquiry assigned to you');
    expect(renderImportSummary({ ...summary, count: 1, locale: 'bg' }).subject).toBe('1 ново запитване за вас');
  });
});
