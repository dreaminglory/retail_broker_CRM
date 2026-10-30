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
    ['+44 7700 900123', '+447700900123'],
    ['+49 30 123456', '+4930123456'],
    ['00447700900123', '+447700900123'],
  ])('normalizes foreign number %s to E.164', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ['02 987 6543', '+35929876543'],
    ['02 123 4567', '+35921234567'],
    ['032 123 456', '+35932123456'],
  ])('normalizes landline %s to E.164', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  // The old parser and the caller backfill accept these, so they exist in stored data.
  it.each([
    ['0123456789', '+359123456789'],
    ['+359123456789', '+359123456789'],
  ])('still accepts %s, 9 national digits outside the known BG ranges', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    [''],
    ['12'],
    ['088812345678'],
    ['+44 12'],
    ['phone'],
    ['call me on 0888 123 456'],
  ])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('maps every accepted format of the same number to one value', () => {
    const variants = ['0888123456', '+359 888 123 456', '359-888-123-456'];
    expect(new Set(variants.map(normalizePhone))).toEqual(new Set(['+359888123456']));
  });
});
