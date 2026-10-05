import { describe, it, expect } from 'vitest';
import en from './en.json';
import bg from './bg.json';

describe('Messages ICU Validation', () => {
  it('should have parity between en and bg keys', () => {
    const getKeys = (obj: any, prefix = ''): string[] => {
      return Object.keys(obj).reduce((acc: string[], key: string) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          return [...acc, ...getKeys(obj[key], path)];
        }
        return [...acc, path];
      }, []);
    };

    const enKeys = getKeys(en).sort();
    const bgKeys = getKeys(bg).sort();

    expect(enKeys).toEqual(bgKeys);
  });

  it('should not have empty values', () => {
    const getValues = (obj: any): string[] => {
      return Object.values(obj).reduce((acc: string[], value: any) => {
        if (typeof value === 'object' && value !== null) {
          return [...acc, ...getValues(value)];
        }
        return [...acc, value as string];
      }, []);
    };

    const enValues = getValues(en);
    const bgValues = getValues(bg);

    enValues.forEach(val => expect(val.trim()).not.toBe(''));
    bgValues.forEach(val => expect(val.trim()).not.toBe(''));
  });

  it('should be ICU-valid (no unmatched brackets)', () => {
    const checkBrackets = (obj: any) => {
      const values = Object.values(obj);
      for (const value of values) {
        if (typeof value === 'object' && value !== null) {
          checkBrackets(value);
        } else if (typeof value === 'string') {
          const openCount = (value.match(/\{/g) || []).length;
          const closeCount = (value.match(/\}/g) || []).length;
          expect(openCount).toBe(closeCount);
        }
      }
    };

    checkBrackets(en);
    checkBrackets(bg);
  });
});
