import { describe, expect, it } from 'vitest';
import {
  contactLinksFor,
  isMobile,
  mailtoHref,
  telHref,
  viberHref,
  whatsAppHref,
} from './contact-links';

const BG_MOBILE = '+359888123456';
const BG_LANDLINE = '+35929876543';
const UK_MOBILE = '+447400123456';

describe('href builders', () => {
  it('builds tel: with the E.164 number', () => {
    expect(telHref(BG_MOBILE)).toBe('tel:+359888123456');
  });

  it('encodes the + in the Viber link', () => {
    expect(viberHref(BG_MOBILE)).toBe('viber://chat?number=%2B359888123456');
  });

  it('puts digits only in the wa.me link', () => {
    expect(whatsAppHref(BG_MOBILE)).toBe('https://wa.me/359888123456');
  });

  it('builds mailto: with the trimmed address', () => {
    expect(mailtoHref(' ivan@example.bg ')).toBe('mailto:ivan@example.bg');
  });
});

describe('isMobile', () => {
  it('is true for a BG mobile', () => {
    expect(isMobile(BG_MOBILE)).toBe(true);
  });

  it('is false for a BG landline', () => {
    expect(isMobile(BG_LANDLINE)).toBe(false);
  });

  it('is true for a foreign mobile', () => {
    expect(isMobile(UK_MOBILE)).toBe(true);
  });

  it('is false for something that does not parse', () => {
    expect(isMobile('12')).toBe(false);
  });
});

const kinds = (value: string, type: Parameters<typeof contactLinksFor>[1]) =>
  contactLinksFor(value, type).map((link) => link.kind);

describe('contactLinksFor', () => {
  it('gives a BG mobile Call, Viber and WhatsApp', () => {
    expect(contactLinksFor(BG_MOBILE, 'phone')).toEqual([
      { kind: 'call', href: 'tel:+359888123456' },
      { kind: 'viber', href: 'viber://chat?number=%2B359888123456' },
      { kind: 'whatsapp', href: 'https://wa.me/359888123456' },
    ]);
  });

  it('gives a BG landline Call only', () => {
    expect(kinds(BG_LANDLINE, 'phone')).toEqual(['call']);
  });

  it('gives a saved Viber or WhatsApp method the messengers even on a landline', () => {
    expect(kinds(BG_LANDLINE, 'viber')).toEqual(['call', 'viber', 'whatsapp']);
    expect(kinds(BG_LANDLINE, 'whatsapp')).toEqual(['call', 'viber', 'whatsapp']);
  });

  it('gives a foreign mobile all three', () => {
    expect(kinds(UK_MOBILE, 'phone')).toEqual(['call', 'viber', 'whatsapp']);
  });

  it('normalizes a local-format number first', () => {
    expect(contactLinksFor('0888 123 456', 'phone')[0]).toEqual({
      kind: 'call',
      href: 'tel:+359888123456',
    });
  });

  it('gives an unparseable legacy number Call with its digits and no messengers', () => {
    expect(contactLinksFor('ext. 12-34', 'viber')).toEqual([{ kind: 'call', href: 'tel:1234' }]);
    expect(contactLinksFor('+12 34', 'phone')).toEqual([{ kind: 'call', href: 'tel:+1234' }]);
  });

  it('gives an email Email', () => {
    expect(contactLinksFor('ivan@example.bg', 'email')).toEqual([
      { kind: 'email', href: 'mailto:ivan@example.bg' },
    ]);
  });

  it('gives nothing for other methods, empty values or a phone with no digits', () => {
    expect(contactLinksFor('@ivan', 'other')).toEqual([]);
    expect(contactLinksFor('  ', 'email')).toEqual([]);
    expect(contactLinksFor('n/a', 'phone')).toEqual([]);
  });
});
