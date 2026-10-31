import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/lib/actions';
import { MemberService } from './service';

const inviteUserByEmail = vi.fn();
const createInvitation = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ auth: { admin: { inviteUserByEmail } } }),
}));
vi.mock('./repository', () => ({
  MemberRepository: class {
    getAgencyMembers = async () => [];
    createInvitation = createInvitation;
  },
}));

const CTX = { agencyId: 'agency-1', userId: 'user-1', role: 'owner' } as AuthContext;

const invite = () => new MemberService({} as SupabaseClient).inviteMember(CTX, 'new@alpha.bg', 'broker');

describe('MemberService.inviteMember', () => {
  beforeEach(() => {
    inviteUserByEmail.mockReset().mockResolvedValue({ data: { user: { id: 'invited-1' } }, error: null });
    createInvitation.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the invite link to the configured app URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://crm.example.bg');
    vi.stubEnv('NODE_ENV', 'production');

    await invite();

    expect(inviteUserByEmail.mock.calls[0][1].redirectTo).toBe('https://crm.example.bg/auth/callback?next=/update-password');
  });

  it('falls back to localhost outside production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NODE_ENV', 'development');

    await invite();

    expect(inviteUserByEmail.mock.calls[0][1].redirectTo).toBe('http://localhost:3000/auth/callback?next=/update-password');
  });

  it('refuses to invite in production without an app URL, so no broken link goes out', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NODE_ENV', 'production');

    await expect(invite()).rejects.toMatchObject({ code: 'errors.members.invite_failed' });

    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
