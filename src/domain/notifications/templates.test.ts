import { describe, expect, it } from 'vitest';
import { renderDailyDigest } from './templates';
import type { Digest } from './types';

const digest: Digest = {
  overdue: { rows: [{ id: 't1', title: 'Call Ivan about the offer', dueAt: '2026-01-09T09:00:00Z' }], more: 0 },
  dueToday: { rows: [{ id: 't2', title: 'Viewing on Vitosha', dueAt: '2026-01-12T12:30:00Z' }], more: 2 },
  newInquiries: { rows: [{ id: 'i1', callerName: 'Maria Petrova' }, { id: 'i2', callerName: null }], more: 0 },
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
    };
    const { html, subject } = renderDailyDigest({ ...base, digest: hostile, recipientName: '<b>Eve</b>', locale: 'en' });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Eve</b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(subject).not.toMatch(/[<>]/);
  });

  it('shows nothing but the names and titles it was given', () => {
    // The builder's types have no phone, note or subject field; this guards the template's own copy.
    const { html, text } = renderDailyDigest({ ...base, locale: 'en' });

    for (const out of [html, text]) {
      expect(out).not.toMatch(/\+359|0888/);
    }
  });
});
