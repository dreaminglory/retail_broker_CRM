import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('normalizes 10-digit local number with leading 0', () => {
    expect(normalizePhone('0888123456')).toBe('+359888123456');
  });

  it('strips spaces from local numbers', () => {
    expect(normalizePhone('0888 123 456')).toBe('+359888123456');
  });

  it('strips dashes from local numbers', () => {
    expect(normalizePhone('088-812-3456')).toBe('+359888123456');
  });

  it('accepts already normalized E.164 numbers', () => {
    expect(normalizePhone('+359888123456')).toBe('+359888123456');
  });

  it('adds missing plus to country code prefix', () => {
    expect(normalizePhone('359888123456')).toBe('+359888123456');
  });

  it('handles parentheses and dots', () => {
    expect(normalizePhone('(0888).123.456')).toBe('+359888123456');
  });

  it('returns null for unrecognizable prefix', () => {
    expect(normalizePhone('44888123456')).toBeNull();
  });

  it('returns null for incorrect digit count', () => {
    expect(normalizePhone('088812345')).toBeNull(); // too few digits
    expect(normalizePhone('08881234567')).toBeNull(); // too many digits
  });
});
