import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { AreaService } from '@/domain/areas/service';
import { SettlementService } from '@/domain/settlements/service';
import { PropertyService } from './service';

describeServices('PropertyService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let properties: PropertyService;
  let sofiaId: string;
  let lozenetsId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    properties = new PropertyService(broker.db);
    [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
    const areas = await new AreaService(broker.db).listActiveForSettlement(broker.agencyId, sofiaId);
    lozenetsId = areas.find((area) => area.name === 'Лозенец')!.id;
  });

  afterAll(() => cleanup.run());

  it('creates the AC-1 apartment with a code, the creator as responsible broker, and loads its page', async () => {
    const created = await properties.create(broker.agencyId, broker.userId, {
      type: 'apartment',
      rooms: 2,
      area_m2: 68,
      settlement_id: sofiaId,
      area_id: lozenetsId,
    });
    cleanup.track('properties', created.id);

    expect(created.code).toBeGreaterThan(1000);
    expect(created.assigned_to).toBe(broker.userId);
    expect(created.created_by).toBe(broker.userId);

    const detail = await properties.getDetail(created.id, broker.agencyId, 'en');
    expect(detail).toMatchObject({
      code: created.code,
      settlement: { name: 'Sofia' },
      area: { name: 'Лозенец' },
      assignee: { id: broker.userId },
    });
  });

  it('refuses an assignee who is not an active member', async () => {
    await expect(
      properties.create(broker.agencyId, broker.userId, {
        type: 'garage',
        settlement_id: sofiaId,
        assigned_to: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toEqual(new DomainError('properties.errors.assigneeNotMember'));
  });

  it('refuses an area from another settlement', async () => {
    const [plovdiv] = await new SettlementService(broker.db).search('Пловдив', 'bg');
    await expect(
      properties.create(broker.agencyId, broker.userId, { type: 'garage', settlement_id: plovdiv.id, area_id: lozenetsId }),
    ).rejects.toEqual(new DomainError('properties.errors.areaNotInSettlement'));
  });

  it('refuses a rule 3 violation that skips the form', async () => {
    await expect(
      properties.create(broker.agencyId, broker.userId, { type: 'apartment', settlement_id: sofiaId }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("returns nothing for another agency's property (404)", async () => {
    const created = await properties.create(broker.agencyId, broker.userId, { type: 'garage', settlement_id: sofiaId });
    cleanup.track('properties', created.id);

    const outsider = await signInAs('broker@beta.bg');
    expect(await new PropertyService(outsider.db).getDetail(created.id, outsider.agencyId, 'bg')).toBeNull();
    expect(await properties.getDetail(created.id, outsider.agencyId, 'bg')).toBeNull();
  });
});
