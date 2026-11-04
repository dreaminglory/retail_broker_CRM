import { describe, expect, it } from 'vitest';
import { settlementNameColumn, settlementQuerySchema } from './validation';

describe('settlementNameColumn', () => {
  it('searches the Bulgarian name for Cyrillic text', () => {
    expect(settlementNameColumn('плов')).toBe('name_bg');
  });

  it('searches the transliterated name for Latin text', () => {
    expect(settlementNameColumn('plov')).toBe('name_en');
  });
});

describe('settlementQuerySchema', () => {
  it('trims the query', () => {
    expect(settlementQuerySchema.parse('  плов ')).toBe('плов');
  });

  it('refuses a very long query', () => {
    expect(settlementQuerySchema.safeParse('x'.repeat(101)).success).toBe(false);
  });
});
