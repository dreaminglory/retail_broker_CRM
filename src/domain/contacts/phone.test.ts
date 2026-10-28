import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['0888123456', '+359888123456'],
    ['0888 123 456', '+359888123456'],
    ['088-812-3456', '+359888123456'],
    ['(088) 812.3456', '+359888123456'],
    ['0888 123 456', '+359888123456'],
    ['+359888123456', '+359888123456'],
    ['359888123456', '+359888123456'],
  ])('normalizes %s to E.164', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    [''],
    ['888123456'],
    ['+44 20 7946 0958'],
    ['08881234'],
    ['088812345678'],
    ['phone'],
  ])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('maps every accepted format of the same number to one value', () => {
    const variants = ['0888123456', '+359 888 123 456', '359-888-123-456'];
    expect(new Set(variants.map(normalizePhone))).toEqual(new Set(['+359888123456']));
  });

  // Landlines have 8 digits after +359 (02 + 7 for Sofia, 032 + 6 for Plovdiv),
  // but normalizePhone only accepts 9, so these are currently rejected.
  it.todo('accepts Sofia landlines: 02 123 4567 → +35921234567');
  it.todo('accepts Plovdiv landlines: 032 123 456 → +35932123456');
});
