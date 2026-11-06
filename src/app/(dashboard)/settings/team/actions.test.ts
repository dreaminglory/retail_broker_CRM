import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';
import { DomainError } from '@/lib/errors';

let fake: FakeSupabase;
const resendInvitation = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/domain/agencies/settings', () => ({
  getAgencySettings: async () => ({ timezone: 'Europe/Sofia' }),
}));
vi.mock('@/domain/members/service', () => ({
  MemberService: class {
    resendInvitation = resendInvitation;
  },
}));

const { resendInvitation: resendInvitationAction } = await import('./actions');

const MEMBERSHIP = '11111111-1111-4111-8111-111111111111';

function form(membershipId: string | null): FormData {
  const data = new FormData();
  if (membershipId) data.set('membershipId', membershipId);
  return data;
}

beforeEach(() => {
  fake = createFakeSupabase({ role: 'owner', userId: 'user-me', agencyId: 'agency-1' });
  resendInvitation.mockReset().mockResolvedValue(undefined);
});

describe('resendInvitation action', () => {
  it('resends with the agency timezone and returns success', async () => {
    const result = await resendInvitationAction(form(MEMBERSHIP));

    expect(result).toEqual({ success: true, data: undefined });
    expect(resendInvitation).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'agency-1' }), MEMBERSHIP, 'Europe/Sofia');
  });

  it('returns a validation error without calling the service for a missing id', async () => {
    const result = await resendInvitationAction(form(null));

    expect(result.success).toBe(false);
    expect(resendInvitation).not.toHaveBeenCalled();
  });

  it('returns the service refusal as an error result', async () => {
    resendInvitation.mockRejectedValue(new DomainError('errors.members.resend_too_soon', undefined, { time: '16:10' }));

    const result = await resendInvitationAction(form(MEMBERSHIP));

    expect(result).toMatchObject({ success: false, error: 'errors.members.resend_too_soon' });
  });
});
