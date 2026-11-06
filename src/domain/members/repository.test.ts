import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemberRepository } from './repository';

describe('MemberRepository.createInvitation', () => {
  it('sets invitation_sent_at together with invited_at', async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'm1' }, error: null }) }),
    });
    const db = { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient;

    await new MemberRepository(db).createInvitation('a1', 'New@Example.com', 'broker', 'u1', 'u2');

    const row = insert.mock.calls[0][0];
    expect(row.invitation_email).toBe('new@example.com');
    expect(row.invitation_sent_at).toEqual(expect.any(String));
    expect(row.invitation_sent_at).toBe(row.invited_at);
  });
});
