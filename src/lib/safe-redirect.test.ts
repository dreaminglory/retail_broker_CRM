import { describe, it, expect } from 'vitest';
import { isSafeRelativePath } from './safe-redirect';

describe('isSafeRelativePath', () => {
  it('allows safe relative paths', () => {
    expect(isSafeRelativePath('/dashboard')).toBe(true);
    expect(isSafeRelativePath('/contacts/123')).toBe(true);
    expect(isSafeRelativePath('/')).toBe(true);
    expect(isSafeRelativePath('/settings?tab=profile')).toBe(true);
  });

  it('rejects absolute URLs', () => {
    expect(isSafeRelativePath('https://evil.com')).toBe(false);
    expect(isSafeRelativePath('http://example.com/dashboard')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeRelativePath('//evil.com')).toBe(false);
    expect(isSafeRelativePath('///evil.com')).toBe(false);
  });

  it('rejects backslash URLs', () => {
    expect(isSafeRelativePath('\\\\evil.com')).toBe(false);
    expect(isSafeRelativePath('/\\evil.com')).toBe(false);
    expect(isSafeRelativePath('\\/evil.com')).toBe(false);
  });

  it('rejects invalid or missing paths', () => {
    expect(isSafeRelativePath(null)).toBe(false);
    expect(isSafeRelativePath(undefined)).toBe(false);
    expect(isSafeRelativePath('')).toBe(false);
    expect(isSafeRelativePath('dashboard')).toBe(false); // must start with /
  });
});
