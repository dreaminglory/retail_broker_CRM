import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { SettlementService } from '@/domain/settlements/service';
import { AreaService } from './service';

describeServices('AreaService against the local stack', () => {
  const cleanup = createRowCleanup();
  let owner: TestSession;
  let areas: AreaService;
  let sofiaId: string;

  beforeAll(async () => {
    owner = await signInAs('owner@alpha.bg');
    areas = new AreaService(owner.db);
    [{ id: sofiaId }] = await new SettlementService(owner.db).search('София', 'bg');
  });

  afterAll(() => cleanup.run());

  function uniqueName(prefix: string) {
    return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
  }

  it('adds an area to a settlement at the end and lists it there (AC-7)', async () => {
    const name = uniqueName('Лозенец');
    const area = await areas.create(owner.agencyId, { settlement_id: sofiaId, name });
    cleanup.track('areas', area.id);

    const listed = await areas.listForSettlement(owner.agencyId, sofiaId);
    expect(listed.map((row) => row.name)).toContain(name);
    expect(area.sort_order).toBe(Math.max(...listed.map((row) => row.sort_order)));
  });

  it('refuses a duplicate name in any letter case with an i18n key (AC-7)', async () => {
    const name = uniqueName('Дубъл');
    const area = await areas.create(owner.agencyId, { settlement_id: sofiaId, name });
    cleanup.track('areas', area.id);

    await expect(areas.create(owner.agencyId, { settlement_id: sofiaId, name: name.toUpperCase() })).rejects.toEqual(
      new DomainError('areas.errors.duplicateName'),
    );
  });

  it('renames, deactivates and reorders', async () => {
    const first = await areas.create(owner.agencyId, { settlement_id: sofiaId, name: uniqueName('Първи') });
    const second = await areas.create(owner.agencyId, { settlement_id: sofiaId, name: uniqueName('Втори') });
    cleanup.track('areas', first.id);
    cleanup.track('areas', second.id);

    const renamed = await areas.update(first.id, owner.agencyId, { name: uniqueName('Преименуван') });
    await areas.update(second.id, owner.agencyId, { is_active: false });
    await areas.reorder(owner.agencyId, [
      { id: second.id, sort_order: 0 },
      { id: first.id, sort_order: 1 },
    ]);

    const listed = await areas.listForSettlement(owner.agencyId, sofiaId);
    expect(listed.find((row) => row.id === first.id)).toMatchObject({ name: renamed.name, sort_order: 1 });
    expect(listed.find((row) => row.id === second.id)).toMatchObject({ is_active: false, sort_order: 0 });
    expect((await areas.listActiveForSettlement(owner.agencyId, sofiaId)).map((row) => row.id)).not.toContain(second.id);
  });

  it('counts areas per settlement for the settings page', async () => {
    const counts = await areas.settlementsWithAreas(owner.agencyId, 'bg');
    expect(counts.find((row) => row.settlement.id === sofiaId)).toMatchObject({ settlement: { name: 'София' } });
  });

  it('keeps a broker from adding areas and another agency from seeing them (AC-6, AC-7)', async () => {
    const broker = await signInAs('broker@alpha.bg');
    await expect(
      new AreaService(broker.db).create(broker.agencyId, { settlement_id: sofiaId, name: uniqueName('Брокер') }),
    ).rejects.toBeInstanceOf(DomainError);

    const outsider = await signInAs('broker@beta.bg');
    expect(await new AreaService(outsider.db).listForSettlement(owner.agencyId, sofiaId)).toEqual([]);
  });
});
