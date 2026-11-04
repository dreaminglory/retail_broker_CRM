import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery, toPrefixQuery } from './query';

describe('normalizeSearchQuery', () => {
  it.each([
    ['0888 123 456', '+359888123456'],
    ['088-812-3456', '+359888123456'],
    ['+359 888 123 456', '+359888123456'],
    ['359888123456', '+359888123456'],
    ['02 987 6543', '+35929876543'],
    ['+44 7700 900123', '+447700900123'],
  ])('turns the phone number %s into E.164', (query, expected) => {
    expect(normalizeSearchQuery(query)).toBe(expected);
  });

  it.each([
    ['Ivan Ivanov'],
    ['ivan@example.bg'],
    ['Lozenets 0888'],
    ['0888'],
    ['0888 12'],
    ['12345678'],
    ['2026'],
  ])('leaves %s unchanged', (query) => {
    expect(normalizeSearchQuery(query)).toBe(query);
  });
});

describe('toPrefixQuery', () => {
  it('requires every word as a prefix', () => {
    expect(toPrefixQuery('  Лозенец  кричим ')).toBe("'Лозенец':* & 'кричим':*");
  });

  it('lets a bare number match its + form too', () => {
    expect(toPrefixQuery('359')).toBe("('+359':* | '359':*)");
  });

  it('escapes quotes and backslashes so the tsquery always parses', () => {
    expect(toPrefixQuery("O'Neil")).toBe("'O''Neil':*");
    expect(toPrefixQuery('a\\')).toBe("'a\\\\':*");
  });

  it('is empty for a blank query', () => {
    expect(toPrefixQuery('   ')).toBe('');
  });
});
