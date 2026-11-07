import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const step = vi.fn();

vi.mock('@/lib/actions', () => ({
  getAuthContext: async () => ({ supabase: {}, userId: 'u-1', agencyId: 'a-1', role: 'manager' }),
}));
vi.mock('@/domain/smart-lists/service', () => ({
  SmartListService: vi.fn(function () {
    return { step };
  }),
}));

const { GET } = await import('./route');

const DEAL = '11111111-1111-4111-8111-111111111111';

function request(query: string, id = 'no-next-action') {
  return GET({ url: `http://localhost:3000/lists/${id}/step?${query}` } as NextRequest, {
    params: Promise.resolve({ id }),
  } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('the queue step route (rule 7)', () => {
  it('redirects to the deal the step lands on', async () => {
    step.mockResolvedValue({ done: false, id: DEAL, sortKey: [5, DEAL], pos: 1, total: 3, scope: 'mine' });

    const response = await request('dir=next&pos=0');

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe(`/opportunities/${DEAL}`);
  });

  it('a database error goes back to the list page, logged, without the error in the response', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    step.mockRejectedValue(new Error('canceling statement due to statement timeout'));

    const response = await request('dir=next&pos=2&scope=agency');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/lists/no-next-action?scope=agency');
    expect(await response.text()).not.toContain('statement timeout');
    expect(error).toHaveBeenCalledWith('Smart list step failed:', expect.any(Error));
    error.mockRestore();
  });
});
