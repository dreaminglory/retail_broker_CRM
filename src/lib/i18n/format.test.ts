import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('i18n Formatting', () => {
  describe('formatCurrency', () => {
    it('formats USD correctly for en locale', () => {
      const result = formatCurrency(1234.56, 'USD', 'en');
      // Node 18+ uses standard narrow non-breaking space for currencies or regular depending on env
      // But standard 'en' locale puts the symbol first.
      expect(result).toMatch(/^\$1,234\.56$/);
    });

    it('formats BGN correctly for bg locale', () => {
      const result = formatCurrency(1234.56, 'BGN', 'bg');
      // In bg locale, BGN is usually written as "1234,56 лв." or "1 234,56 лв."
      // Since environments can differ slightly on whitespace (NBSP etc), we can normalize spaces
      expect(result.replace(/\s/g, ' ')).toMatch(/1\s?234,56/);
      expect(result).toContain('лв');
    });
  });

  describe('formatDate', () => {
    it('formats date correctly for en locale', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = formatDate(date, 'PP', 'en');
      expect(result).toMatch(/Jan 15, 2024/);
    });

    it('formats date correctly for bg locale', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = formatDate(date, 'PP', 'bg');
      expect(result).toMatch(/15\sяну(\.|ари)?\s2024/);
    });
  });
});
