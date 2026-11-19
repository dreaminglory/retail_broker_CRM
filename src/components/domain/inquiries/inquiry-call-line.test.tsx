import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import { InquiryCallLine } from './inquiry-call-line';

const NOW = new Date('2026-11-19T14:00:00Z'); // 16:00 in Sofia

function render(props: Parameters<typeof InquiryCallLine>[0], locale: 'en' | 'bg' = 'en') {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : bg} timeZone="UTC" now={NOW}>
      <InquiryCallLine {...props} />
    </NextIntlClientProvider>,
  )
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const base = {
  status: 'contacted' as const,
  received_at: '2026-11-19T09:55:00Z',
  contacted_at: '2026-11-19T12:05:00Z',
  calls: { lastCall: { outcome: 'No answer', at: '2026-11-19T12:05:00Z', channel: 'viber' as const }, nextRetryAt: null },
};

describe('InquiryCallLine (spec phone-loop rule 9, AC-9)', () => {
  it('shows the contact time and the last call in agency time', () => {
    const text = render({ inquiry: base, timeZone: 'Europe/Sofia' });
    expect(text).toContain('Contacted after 2 h 10 min');
    expect(text).toContain('Last call: No answer · 02:05 PM');
  });

  it('speaks Bulgarian', () => {
    const text = render({ inquiry: base, timeZone: 'Europe/Sofia' }, 'bg');
    expect(text).toContain('Свързан след 2 ч 10 мин');
    // The outcome is what the broker saved, in their language; only the frame is translated.
    expect(text).toContain('Последно обаждане: No answer · 14:05');
  });

  it('dates a call from another day and translates a stored outcome key', () => {
    const text = render({
      inquiry: { ...base, calls: { lastCall: { outcome: 'phoneLoop.cancelledByDismiss', at: '2026-11-17T08:30:00Z', channel: null }, nextRetryAt: null } },
      timeZone: 'Europe/Sofia',
    });
    expect(text).toMatch(/Last call: Cancelled: the inquiry was dismissed · Nov 17, 10:30 AM/);
  });

  it('shows the pending retry of a new or contacted inquiry', () => {
    const text = render({
      inquiry: { ...base, calls: { lastCall: base.calls.lastCall, nextRetryAt: '2026-11-19T15:05:00Z' } },
      timeZone: 'Europe/Sofia',
    });
    expect(text).toContain('Call again 05:05 PM');
  });

  it('shows nothing for an inquiry never contacted and without calls', () => {
    expect(render({ inquiry: { status: 'new', received_at: base.received_at, contacted_at: null, calls: undefined }, timeZone: 'Europe/Sofia' })).toBe('');
  });

  it('hides the retry once the inquiry is converted or dismissed', () => {
    const text = render({
      inquiry: { ...base, status: 'converted', calls: { lastCall: null, nextRetryAt: '2026-11-19T15:05:00Z' } },
      timeZone: 'Europe/Sofia',
    });
    expect(text).not.toContain('Call again');
  });
});
