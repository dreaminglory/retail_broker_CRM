import { describe, expect, it } from 'vitest';
import { authErrorKey } from './auth-errors';

describe('authErrorKey', () => {
  it.each([
    ['invalid_credentials', 'invalid_credentials'],
    ['email_exists', 'user_already_exists'],
    ['user_already_exists', 'user_already_exists'],
    ['over_email_send_rate_limit', 'rate_limited'],
  ])('maps %s to %s', (code, key) => {
    expect(authErrorKey({ code })).toBe(key);
  });

  it('falls back to generic for an unknown or missing code', () => {
    expect(authErrorKey({ code: 'something_new' })).toBe('generic');
    expect(authErrorKey({})).toBe('generic');
  });
});
