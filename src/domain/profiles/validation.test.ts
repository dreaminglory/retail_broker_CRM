import { describe, expect, it } from 'vitest';
import { updateDigestEnabledSchema } from './validation';

describe('updateDigestEnabledSchema', () => {
  it('accepts on and off', () => {
    expect(updateDigestEnabledSchema.parse({ digest_enabled: true })).toEqual({ digest_enabled: true });
    expect(updateDigestEnabledSchema.parse({ digest_enabled: false })).toEqual({ digest_enabled: false });
  });

  it('refuses anything that is not a boolean', () => {
    for (const digest_enabled of ['false', 0, null, undefined]) {
      expect(updateDigestEnabledSchema.safeParse({ digest_enabled }).success, String(digest_enabled)).toBe(false);
    }
  });
});
