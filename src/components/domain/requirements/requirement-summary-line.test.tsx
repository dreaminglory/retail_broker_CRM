import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import { RequirementSummaryLine } from './requirement-summary-line';

const MESSAGES = { bg, en };

function render(locale: 'bg' | 'en', summary: string | undefined) {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Sofia">
      <RequirementSummaryLine summary={summary} />
    </NextIntlClientProvider>,
  ).replace(/<!-- -->/g, '');
}

describe('RequirementSummaryLine', () => {
  it.each([
    ['bg', 'Изисквания: '],
    ['en', 'Requirements: '],
  ] as const)('shows the line, named for screen readers, in %s', (locale, label) => {
    const html = render(locale, 'Apartment, Лозенец');

    expect(html).toContain(`<span class="sr-only">${label}</span>`);
    expect(html).toContain('title="Apartment, Лозенец">Apartment, Лозенец</span>');
  });

  it('renders nothing without a summary', () => {
    expect(render('bg', undefined)).toBe('');
  });
});
