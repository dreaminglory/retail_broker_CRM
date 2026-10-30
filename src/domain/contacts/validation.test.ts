import { describe, expect, it } from 'vitest';
import {
  CONTACT_PICKER_LIMIT,
  contactMethodSchema,
  contactPickerQuerySchema,
  createContactSchema,
  escapeLikePattern,
  generateDisplayName,
  normalizeContactMethodValue,
} from './validation';

describe('generateDisplayName', () => {
  it('joins whichever parts of a person name are present', () => {
    expect(generateDisplayName('person', { first_name: 'Ivan', last_name: 'Ivanov' })).toBe('Ivan Ivanov');
    expect(generateDisplayName('person', { last_name: 'Ivanov' })).toBe('Ivanov');
  });

  it('uses the company name for an organization', () => {
    expect(generateDisplayName('organization', { company_name: ' AlphaCorp ', first_name: 'Ivan' })).toBe('AlphaCorp');
  });
});

describe('contactMethodSchema', () => {
  const method = (type: 'phone' | 'email' | 'viber' | 'whatsapp' | 'other', value: string) =>
    contactMethodSchema.safeParse({ type, value });

  it('holds phone-like types to a parseable number', () => {
    expect(method('phone', '0888 123 456').success).toBe(true);
    expect(method('viber', 'not a number').success).toBe(false);
    expect(method('whatsapp', 'not a number').success).toBe(false);
  });

  it('holds email to an email address', () => {
    expect(method('email', 'a@b.bg').success).toBe(true);
    expect(method('email', 'nope').success).toBe(false);
  });

  it('accepts free text for other', () => {
    expect(method('other', 'ask at reception').success).toBe(true);
  });
});

describe('normalizeContactMethodValue', () => {
  it('stores phones as E.164 and emails lowercase', () => {
    expect(normalizeContactMethodValue('phone', '0888 123 456')).toBe('+359888123456');
    expect(normalizeContactMethodValue('email', ' Office@Alpha.BG ')).toBe('office@alpha.bg');
  });
});

describe('createContactSchema', () => {
  it('needs a name for a person and a company name for an organization', () => {
    expect(createContactSchema.safeParse({ type: 'person' }).success).toBe(false);
    expect(createContactSchema.safeParse({ type: 'person', last_name: 'Ivanov' }).success).toBe(true);
    expect(createContactSchema.safeParse({ type: 'organization' }).success).toBe(false);
    expect(createContactSchema.safeParse({ type: 'organization', company_name: 'AlphaCorp' }).success).toBe(true);
  });
});

describe('contactPickerQuerySchema', () => {
  it('trims the typed text', () => {
    expect(contactPickerQuerySchema.parse('  Ivan  ')).toBe('Ivan');
  });

  it('accepts an empty query (the picker lists the first contacts)', () => {
    expect(contactPickerQuerySchema.parse('')).toBe('');
  });

  it('rejects text over 100 characters', () => {
    expect(contactPickerQuerySchema.safeParse('x'.repeat(101)).success).toBe(false);
    expect(contactPickerQuerySchema.safeParse('x'.repeat(100)).success).toBe(true);
  });

  it('rejects anything that is not a string', () => {
    expect(contactPickerQuerySchema.safeParse(undefined).success).toBe(false);
    expect(contactPickerQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    const bs = String.fromCharCode(92);
    expect(escapeLikePattern(`50%_off${bs}`)).toBe(`50${bs}%${bs}_off${bs}${bs}`);
  });

  it('drops * because PostgREST would read it as a wildcard', () => {
    expect(escapeLikePattern('a*b')).toBe('ab');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLikePattern('Иван Петров')).toBe('Иван Петров');
  });
});

describe('CONTACT_PICKER_LIMIT', () => {
  it('is 20 results (spec rule 8)', () => {
    expect(CONTACT_PICKER_LIMIT).toBe(20);
  });
});
