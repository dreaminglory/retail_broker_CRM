import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { saveRequirementAction } = await import('./actions');

const OPP_ID = '22222222-2222-4222-8222-222222222222';
const SOFIA = '33333333-3333-4333-8333-333333333333';

function withDeal(deal: { type: string; status: string }, rpcErrors?: Record<string, { code?: string; message: string }>) {
  fake = createFakeSupabase({
    role: 'broker',
    tables: { opportunities: { id: OPP_ID, ...deal, participants: [] } },
    rpcErrors,
  });
}

describe('saveRequirementAction', () => {
  it('saves through save_requirement only', async () => {
    withDeal({ type: 'buyer', status: 'active' });

    const result = await saveRequirementAction(OPP_ID, { budget_max: '200000', locations: [{ settlement_id: SOFIA }] });

    expect(result).toEqual({ success: true, data: undefined });
    expect(fake.touchedTables).toEqual(['opportunities', 'rpc:save_requirement']);
    expect(fake.writes).toEqual([]);
  });

  it('refuses a form with no criterion before any query', async () => {
    withDeal({ type: 'buyer', status: 'active' });

    const result = await saveRequirementAction(OPP_ID, { wishes: 'only wishes' });

    expect(result).toMatchObject({ success: false, error: 'validation.requirement_criterion_required' });
    expect(fake.touchedTables).toEqual([]);
  });

  it('returns field errors for a range the wrong way round', async () => {
    withDeal({ type: 'buyer', status: 'active' });

    const result = await saveRequirementAction(OPP_ID, { rooms_min: 4, rooms_max: 2 });

    expect(result).toMatchObject({ success: false, fieldErrors: { rooms_max: ['validation.min_above_max'] } });
  });

  it('refuses a closed deal without calling the RPC', async () => {
    withDeal({ type: 'buyer', status: 'won' });

    const result = await saveRequirementAction(OPP_ID, { budget_max: 1 });

    expect(result).toEqual({ success: false, error: 'requirements.errors.readOnly' });
    expect(fake.touchedTables).not.toContain('rpc:save_requirement');
  });

  it("passes on the RPC's key", async () => {
    withDeal({ type: 'tenant', status: 'nurture' }, { save_requirement: { code: 'P0001', message: 'requirements.errors.invalidLocation' } });

    const result = await saveRequirementAction(OPP_ID, { budget_max: 1 });

    expect(result).toEqual({ success: false, error: 'requirements.errors.invalidLocation' });
  });

  it('refuses an id that is not a uuid', async () => {
    withDeal({ type: 'buyer', status: 'active' });

    expect((await saveRequirementAction('nope', { budget_max: 1 })).success).toBe(false);
    expect(fake.touchedTables).toEqual([]);
  });
});
