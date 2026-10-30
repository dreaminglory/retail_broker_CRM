import { afterAll, describe, expect, it } from 'vitest';
import { assertLocalUrl, createRowCleanup, describeServices, signInAs } from './supabase-test-client';

describe('assertLocalUrl', () => {
  it('accepts a local stack', () => {
    expect(() => assertLocalUrl('http://127.0.0.1:54321')).not.toThrow();
    expect(() => assertLocalUrl('http://localhost:54321')).not.toThrow();
  });

  it('refuses a hosted project', () => {
    expect(() => assertLocalUrl('https://abc.supabase.co')).toThrow(/local/);
  });

  it('refuses a local-looking name on another host', () => {
    expect(() => assertLocalUrl('https://localhost.example.com')).toThrow(/local/);
  });
});

describeServices('signInAs', () => {
  const cleanup = createRowCleanup();
  afterAll(() => cleanup.run());

  it('returns the seeded user with their agency', async () => {
    const { userId, agencyId } = await signInAs('broker@alpha.bg');
    const { agencyId: otherAgencyId } = await signInAs('broker@beta.bg');

    expect(userId).toBeTruthy();
    expect(agencyId).toBeTruthy();
    expect(agencyId).not.toBe(otherAgencyId);
  });

  it('keeps another agency out of reach, as RLS does in the app', async () => {
    const alpha = await signInAs('broker@alpha.bg');
    const beta = await signInAs('broker@beta.bg');

    const { data: inserted, error } = await alpha.db
      .from('contacts')
      .insert({ agency_id: alpha.agencyId, type: 'person', first_name: 'Tenant', display_name: 'Tenant Check', created_by: alpha.userId })
      .select('id')
      .single();
    expect(error).toBeNull();
    cleanup.track('contacts', inserted!.id);

    const { data: seenByBeta } = await beta.db.from('contacts').select('id').eq('id', inserted!.id);
    expect(seenByBeta).toEqual([]);
  });
});
