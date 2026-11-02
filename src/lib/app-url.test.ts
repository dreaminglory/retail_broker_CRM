import { describe, expect, it } from 'vitest';
import { getAppUrl } from './app-url';

describe('getAppUrl', () => {
  it('uses NEXT_PUBLIC_APP_URL when it is set', () => {
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: 'https://crm.example.bg', NODE_ENV: 'production' })).toBe('https://crm.example.bg');
  });

  it('falls back to localhost outside production', () => {
    expect(getAppUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });

  it('returns null in production when it is not set', () => {
    expect(getAppUrl({ NODE_ENV: 'production' })).toBeNull();
    expect(getAppUrl({ NEXT_PUBLIC_APP_URL: '', NODE_ENV: 'production' })).toBeNull();
  });
});
