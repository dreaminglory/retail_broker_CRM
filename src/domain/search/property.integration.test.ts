import { beforeAll, expect, it } from 'vitest';
import { describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { SearchService } from './service';

const ALPHA_1001 = '11111111-9999-0000-0000-000000000001'; // seeded: Лозенец, ул. Кричим 12

/** ⌘K finds properties (properties Task 16) and keeps to the caller's agency. */
describeServices('Property search against the local stack', () => {
  let alpha: TestSession;
  let beta: TestSession;

  beforeAll(async () => {
    [alpha, beta] = await Promise.all([signInAs('broker@alpha.bg'), signInAs('broker@beta.bg')]);
  });

  const properties = async (session: TestSession, query: string) =>
    (await new SearchService(session.db).globalSearch(session.agencyId, query)).filter((result) => result.type === 'property');

  it.each(['1001', '#1001', 'Лозенец', 'Кричим', 'кричим 12'])('finds #1001 by %j', async (query) => {
    const results = await properties(alpha, query);

    expect(results.map((result) => result.id)).toContain(ALPHA_1001);
  });

  it("never shows Beta's properties to Alpha, or Alpha's to Beta", async () => {
    const [alphaIds, betaIds] = await Promise.all([
      properties(alpha, 'Лозенец').then((results) => results.map((result) => result.id)),
      properties(beta, 'Лозенец').then((results) => results.map((result) => result.id)),
    ]);

    expect(betaIds).not.toContain(ALPHA_1001);
    expect(alphaIds.filter((id) => betaIds.includes(id))).toEqual([]);
  });
});
