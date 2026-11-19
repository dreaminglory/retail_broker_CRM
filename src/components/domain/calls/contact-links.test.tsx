import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import { ContactLinks } from './contact-links';

function render(ui: React.ReactNode, locale: 'en' | 'bg' = 'en') {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : bg} timeZone="Europe/Sofia">
      {ui}
    </NextIntlClientProvider>,
  );
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

describe('ContactLinks (spec phone-loop rule 1, AC-1)', () => {
  it('gives a BG mobile Call, Viber and WhatsApp as real links', () => {
    const html = render(<ContactLinks value="0888 123 456" type="phone" name="Ivan Petrov" />);

    expect(hrefs(html)).toEqual([
      'tel:+359888123456',
      'viber://chat?number=%2B359888123456',
      'https://wa.me/359888123456',
    ]);
    expect(html).toContain('aria-label="Call Ivan Petrov"');
    expect(html).toContain('aria-label="Viber chat with Ivan Petrov"');
    expect(html).toContain('aria-label="WhatsApp chat with Ivan Petrov"');
  });

  it('gives a BG landline Call only', () => {
    const html = render(<ContactLinks value="02 981 2345" type="phone" name="Office" />);

    expect(hrefs(html)).toEqual(['tel:+35929812345']);
  });

  it('gives an email an Email link', () => {
    const html = render(<ContactLinks value="ivan@example.bg" type="email" name="Ivan" />);

    expect(hrefs(html)).toEqual(['mailto:ivan@example.bg']);
    expect(html).toContain('aria-label="Email Ivan"');
  });

  it('renders nothing for a value with no links', () => {
    expect(render(<ContactLinks value="ask the doorman" type="other" name="Ivan" />)).toBe('');
  });

  it('opens WhatsApp in a new tab but keeps tel: and viber: in place', () => {
    const html = render(<ContactLinks value="+359888123456" type="phone" name="Ivan" />);
    const anchors = html.match(/<a [^>]+>/g) ?? [];

    expect(anchors[0]).not.toContain('target=');
    expect(anchors[1]).not.toContain('target=');
    expect(anchors[2]).toContain('target="_blank"');
    expect(anchors[2]).toContain('rel="noopener noreferrer"');
  });

  it('is icon-only by default and shows labels when asked', () => {
    const iconOnly = render(<ContactLinks value="+359888123456" type="phone" name="Ivan" />);
    const labelled = render(<ContactLinks value="+359888123456" type="phone" name="Ivan" showLabels />);

    expect(iconOnly).not.toMatch(/>Call</);
    expect(labelled).toMatch(/>Call</);
    expect(labelled).toMatch(/>Viber</);
  });

  it('makes every button at least 44 px on a phone', () => {
    const html = render(<ContactLinks value="+359888123456" type="phone" name="Ivan" />);
    const anchors = html.match(/<a [^>]+>/g) ?? [];

    expect(anchors).toHaveLength(3);
    for (const a of anchors) expect(a).toMatch(/min-h-11/);
    for (const a of anchors) expect(a).toMatch(/min-w-11/);
  });

  it('has Bulgarian labels', () => {
    const html = render(<ContactLinks value="+359888123456" type="phone" name="Иван" />, 'bg');

    expect(html).toContain('aria-label="Обаждане до Иван"');
  });
});
