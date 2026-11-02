import { describe, expect, it } from 'vitest';
import { detectEncoding } from './detect-encoding';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;
const utf8 = (text: string) => new TextEncoder().encode(text).buffer;

// "Иван" in windows-1251.
const IVAN_1251 = [0xc8, 0xe2, 0xe0, 0xed];

describe('detectEncoding', () => {
  it('reads Cyrillic UTF-8 as UTF-8', () => {
    expect(detectEncoding(utf8('Име,Телефон\nИван,+359888100001\n'))).toBe('utf-8');
  });

  it('reads UTF-8 with a byte order mark as UTF-8', () => {
    expect(detectEncoding(utf8('﻿Име\nИван\n'))).toBe('utf-8');
  });

  it('reads plain ASCII as UTF-8', () => {
    expect(detectEncoding(utf8('Name,Phone\nIvan,+359888100001\n'))).toBe('utf-8');
  });

  it('reads Cyrillic windows-1251 as windows-1251', () => {
    expect(detectEncoding(bytes(...IVAN_1251))).toBe('windows-1251');
  });

  it('finds windows-1251 that only starts after Latin headers and rows', () => {
    const latin = Array.from(new TextEncoder().encode('Name,Phone\n' + 'Ivan,+359888100001\n'.repeat(1000)));

    expect(detectEncoding(bytes(...latin, ...IVAN_1251))).toBe('windows-1251');
  });
});
