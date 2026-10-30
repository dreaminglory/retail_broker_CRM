import { describe, expect, it } from 'vitest';
import { CONTACT_PICKER_LIMIT, contactPickerQuerySchema, escapeLikePattern } from './validation';

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
