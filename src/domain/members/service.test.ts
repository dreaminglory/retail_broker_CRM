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

describe('MemberService.resendInvitation', () => {
  const rpc = vi.fn();
  const membershipId = '11111111-1111-4111-8111-111111111111';
  const resend = (timeZone?: string) =>
    new MemberService({ rpc } as unknown as SupabaseClient).resendInvitation(CTX, membershipId, timeZone);
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://crm.example.bg');
    vi.stubEnv('NODE_ENV', 'production');
    rpc.mockReset().mockImplementation(async () => {
      calls.push('claim');
      return { data: { email: 'pending@alpha.bg', role: 'broker', user_id: 'u1' }, error: null };
    });
    inviteUserByEmail.mockReset().mockImplementation(async () => {
      calls.push('send');
      return { data: { user: { id: 'u1' } }, error: null };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('claims first, then sends the same invitation again', async () => {
    await resend();

    expect(calls).toEqual(['claim', 'send']);
    expect(rpc).toHaveBeenCalledWith('claim_invitation_resend', { p_membership_id: membershipId });
    expect(inviteUserByEmail).toHaveBeenCalledWith('pending@alpha.bg', {
      data: { invited_by: 'user-1', agency_id: 'agency-1' },
      redirectTo: 'https://crm.example.bg/auth/callback?next=/update-password',
    });
  });

  it('sends nothing when the claim is refused', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'errors.forbidden' } });

    await expect(resend()).rejects.toMatchObject({ code: 'errors.forbidden' });

    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('says when it can be resent after a repeat within 5 minutes', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'errors.members.resend_too_soon', details: '2026-11-06T14:10:00+00:00' },
    });

    await expect(resend('Europe/Sofia')).rejects.toMatchObject({
      code: 'errors.members.resend_too_soon',
      params: { time: '16:10' },
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('reports a failed send and does not hide it', async () => {
    inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: { message: 'smtp down' } });

    await expect(resend()).rejects.toMatchObject({ code: 'errors.members.invite_failed' });
  });

  it('does not claim when the app URL is missing, so the cooldown is not used up', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');

    await expect(resend()).rejects.toMatchObject({ code: 'errors.members.invite_failed' });

    expect(rpc).not.toHaveBeenCalled();
  });
});
