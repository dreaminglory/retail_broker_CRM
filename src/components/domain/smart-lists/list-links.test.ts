import { describe, expect, it } from 'vitest';
import { formatListCount } from './list-links';

describe('formatListCount (rule 6)', () => {
  it('is exact up to 999 and "999+" above', () => {
    expect(formatListCount(0)).toBe('0');
    expect(formatListCount(17)).toBe('17');
    expect(formatListCount(999)).toBe('999');
    expect(formatListCount(1000)).toBe('999+');
  });
});
