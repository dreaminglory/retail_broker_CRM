import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { adminClient, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { ProfileRepository } from './repository';

describeServices('ProfileRepository digest setting against the local stack', () => {
  const tempUserIds: string[] = [];
  let admin: SupabaseClient;
  let me: TestSession;
  let colleague: TestSession;

  /** Temp members, so the seeded users other suites sign in as keep their digest on. */
  async function createTempMember(label: string, agencyId: string): Promise<TestSession> {
    const email = `digest-toggle-${label}-${Date.now()}@alpha.bg`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
    if (error) throw new Error(error.message);
    tempUserIds.push(data.user.id);
    const { error: membershipError } = await admin
      .from('agency_memberships')
      .insert({ agency_id: agencyId, user_id: data.user.id, role: 'broker', status: 'active' });
    if (membershipError) throw new Error(membershipError.message);
    return signInAs(email);
  }

  beforeAll(async () => {
    admin = adminClient();
    const { agencyId } = await signInAs('owner@alpha.bg');
    me = await createTempMember('me', agencyId);
    colleague = await createTempMember('colleague', agencyId);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of tempUserIds) await admin.auth.admin.deleteUser(id);
  });

  const stored = async (userId: string) => {
    const { data } = await admin.from('profiles').select('digest_enabled').eq('id', userId).single();
    return data!.digest_enabled;
  };

  it('is on by default', async () => {
    expect(await stored(me.userId)).toBe(true);
    expect((await new ProfileRepository(me.db).getProfile(me.userId))!.digest_enabled).toBe(true);
  });

  it('turns off and on again, and the choice is what a later read returns', async () => {
    const repo = new ProfileRepository(me.db);

    await repo.updateDigestEnabled(me.userId, false);
    expect((await repo.getProfile(me.userId))!.digest_enabled).toBe(false);

    await repo.updateDigestEnabled(me.userId, true);
    expect((await repo.getProfile(me.userId))!.digest_enabled).toBe(true);
  });

  it("can't change a colleague's setting", async () => {
    await expect(new ProfileRepository(me.db).updateDigestEnabled(colleague.userId, false)).rejects.toThrow();

    expect(await stored(colleague.userId)).toBe(true);
  });
});
