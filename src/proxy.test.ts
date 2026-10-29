import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
type CookieMethods = { getAll: () => { name: string; value: string }[]; setAll: (c: CookieToSet[]) => void };

let rotatedCookies: CookieToSet[] = [];
let seenRequestCookies: { name: string; value: string }[] = [];

// Supabase is the boundary: getUser() is where @supabase/ssr refreshes an expired
// access token and hands the new session cookies to setAll().
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: CookieMethods }) => ({
    auth: {
      getUser: async () => {
        seenRequestCookies = opts.cookies.getAll();
        if (rotatedCookies.length > 0) opts.cookies.setAll(rotatedCookies);
        return { data: { user: { id: 'user-1' } }, error: null };
      },
    },
  }),
}));

const { proxy } = await import('./proxy');

function requestWithSession() {
  const request = new NextRequest('http://localhost:3000/today');
  request.cookies.set('sb-127-auth-token', 'old-session');
  return request;
}

describe('proxy session refresh (AD-030, FR-AUT-03)', () => {
  it('reads the session cookies from the request', async () => {
    rotatedCookies = [];

    await proxy(requestWithSession());

    expect(seenRequestCookies).toContainEqual({ name: 'sb-127-auth-token', value: 'old-session' });
  });

  it('sends a refreshed session back to the browser', async () => {
    rotatedCookies = [{ name: 'sb-127-auth-token', value: 'new-session', options: { path: '/' } }];

    const request = requestWithSession();
    const response = await proxy(request);

    expect(response.cookies.get('sb-127-auth-token')?.value).toBe('new-session');
    // ...and the page rendered for this request sees the new session too.
    expect(request.cookies.get('sb-127-auth-token')?.value).toBe('new-session');
  });

  it('lets the request through when nothing was refreshed', async () => {
    rotatedCookies = [];

    const response = await proxy(requestWithSession());

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.getAll()).toEqual([]);
  });
});
