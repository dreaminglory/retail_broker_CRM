import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '@/components/ui/dialog';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';

const logCallAction = vi.fn();
vi.mock('@/app/(dashboard)/calls/actions', () => ({
  logCallAction: (...args: unknown[]) => logCallAction(...args),
  findCallTaskAction: async () => ({ success: true, data: null }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { PostCallForm } = await import('./post-call-sheet');

const INQUIRY = '11111111-1111-4111-8111-111111111111';

function render(ui: React.ReactNode, locale: 'en' | 'bg' = 'en') {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : bg} timeZone="Europe/Sofia">
      <Dialog open>{ui}</Dialog>
    </NextIntlClientProvider>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('PostCallForm (spec phone-loop rule 5)', () => {
  it('asks "Did you reach <name>?" with the three choices and writes nothing on open', () => {
    const html = render(<PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Ivan', channel: 'phone' }} onDone={() => {}} />);

    expect(text(html)).toContain('Did you reach Ivan?');
    expect(text(html)).toMatch(/Answered .*No answer .*Not now/);
    expect(html).not.toContain('Save');
    expect(logCallAction).not.toHaveBeenCalled();
  });

  it('No answer prefills the outcome and offers the retry presets, in 1 h selected', () => {
    const html = render(
      <PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Ivan', channel: 'phone' }} onDone={() => {}} initialResult="no_answer" />,
    );

    expect(html).toMatch(/<textarea[^>]*required[^>]*>No answer<\/textarea>/);
    expect(html).toMatch(/aria-checked="true"[^>]*>In 1 hour</);
    expect(text(html)).toContain('Tomorrow 09:00');
    expect(text(html)).toContain('No retry');
    expect(text(html)).not.toContain('Next Monday');
  });

  it("offers today 18:00 by the agency's clock, not the formatter's timezone", () => {
    vi.useFakeTimers();
    // 15:30 UTC: 17:30 in Sofia (the formatter's zone here), 07:30 in Los Angeles.
    vi.setSystemTime(new Date('2026-01-15T15:30:00Z'));
    try {
      const props = { target: { context: { inquiry_id: INQUIRY }, name: 'Ivan', channel: 'phone' as const }, onDone: () => {}, initialResult: 'no_answer' as const };
      expect(text(render(<PostCallForm timeZone="America/Los_Angeles" {...props} />))).toContain('Today 18:00');
      expect(text(render(<PostCallForm timeZone="Europe/Sofia" {...props} />))).not.toContain('Today 18:00');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Answered requires an outcome: empty textarea and Save disabled', () => {
    const html = render(
      <PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Ivan', channel: 'phone' }} onDone={() => {}} initialResult="answered" />,
    );

    expect(html).toMatch(/<textarea[^>]*required[^>]*><\/textarea>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/);
    expect(html).toMatch(/aria-checked="true"[^>]*>Tomorrow 09:00</);
    expect(text(html)).toContain('Pick a time');
  });

  it('shows a channel picker for "Log call" only', () => {
    const manual = render(<PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Ivan' }} onDone={() => {}} />);
    const tapped = render(<PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Ivan', channel: 'viber' }} onDone={() => {}} />);

    expect(text(manual)).toContain('How did you reach them?');
    expect(text(tapped)).not.toContain('How did you reach them?');
  });

  it('offers no retry on a dismissed inquiry (rule 8)', () => {
    const html = render(
      <PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Ivan', channel: 'phone', noRetry: true }} onDone={() => {}} initialResult="no_answer" />,
    );

    expect(text(html)).toContain('No retry');
    expect(text(html)).not.toContain('In 1 hour');
  });

  it('warns about a deal left with no next action (rule 7)', () => {
    const target = { context: { opportunity_id: INQUIRY }, name: 'Ivan', channel: 'phone' as const, closed: true, deal: { active: true, hasOtherPendingTask: false } };
    const html = render(<PostCallForm timeZone="Europe/Sofia" target={target} onDone={() => {}} initialResult="answered" />);

    expect(text(html)).toContain('This deal will have no next action.');
  });

  it('speaks Bulgarian', () => {
    const html = render(<PostCallForm timeZone="Europe/Sofia" target={{ context: { inquiry_id: INQUIRY }, name: 'Иван', channel: 'phone' }} onDone={() => {}} initialResult="no_answer" />, 'bg');

    expect(text(html)).toContain('Свързахте ли се с Иван?');
    expect(html).toMatch(/>Не вдига<\/textarea>/);
  });
});
