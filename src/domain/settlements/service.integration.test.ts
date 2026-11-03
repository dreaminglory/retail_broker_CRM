import { beforeAll, expect, it } from 'vitest';
import { describeServices, signInAs } from '@/test/supabase-test-client';
import { SettlementService } from './service';

describeServices('SettlementService search against the local stack', () => {
  let settlements: SettlementService;

  beforeAll(async () => {
    const broker = await signInAs('broker@alpha.bg');
    settlements = new SettlementService(broker.db);
  });

  it('finds Пловдив for "плов" in Bulgarian, the city first', async () => {
    const results = await settlements.search('плов', 'bg');
    expect(results[0]).toMatchObject({ name: 'Пловдив', kind: 'city', province: 'Пловдив' });
  });

  it('finds Plovdiv for "plov" in English', async () => {
    const results = await settlements.search('Plov', 'en');
    expect(results[0]).toMatchObject({ name: 'Plovdiv', kind: 'city' });
  });

  it('shows the locale name whatever script was typed', async () => {
    const results = await settlements.search('sofi', 'bg');
    expect(results[0].name).toBe('София');
  });

  it('returns at most 20 rows and treats % as text', async () => {
    expect((await settlements.search('с', 'bg')).length).toBe(20);
    expect(await settlements.search('%', 'bg')).toEqual([]);
  });

  it('loads one settlement by id in the locale', async () => {
    const [plovdiv] = await settlements.search('Пловдив', 'bg');
    expect(await settlements.getById(plovdiv.id, 'en')).toMatchObject({ id: plovdiv.id, name: 'Plovdiv' });
  });
});
