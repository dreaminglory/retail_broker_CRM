import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { OpportunityService } from './service';

describeServices('OpportunityService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let opportunities: OpportunityService;
  let stageId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    opportunities = new OpportunityService(broker.db);
    const { data: stage } = await broker.db
      .from('stages')
      .select('id')
      .eq('agency_id', broker.agencyId)
      .eq('name', 'New')
      .single();
    stageId = stage!.id;
  });

  afterAll(() => cleanup.run());

  async function createOpportunity(title = 'Integration deal') {
    const opportunity = await opportunities.create(broker.agencyId, broker.userId, {
      title,
      type: 'buyer',
      stage_id: stageId,
      assigned_to: broker.userId,
    });
    cleanup.track('opportunities', opportunity.id);
    return opportunity;
  }

  it('closes as won with a closed date', async () => {
    const { id } = await createOpportunity();

    const closed = await opportunities.close(id, broker.agencyId, { outcome: 'won' });

    expect(closed.status).toBe('won');
    expect(closed.closed_at).not.toBeNull();
  });

  it('needs a reason to close as lost, and leaves the deal open without one', async () => {
    const { id } = await createOpportunity();

    await expect(opportunities.close(id, broker.agencyId, { outcome: 'lost' })).rejects.toThrow(
      'validation.lost_reason_required'
    );
    expect((await opportunities.getById(id, broker.agencyId))!.status).toBe('active');

    const lost = await opportunities.close(id, broker.agencyId, { outcome: 'lost', lost_reason: 'Bought elsewhere' });
    expect(lost.status).toBe('lost');
    expect(lost.lost_reason).toBe('Bought elsewhere');
  });

  it('reopens a lost deal, clearing the closed date and reason', async () => {
    const { id } = await createOpportunity();
    await opportunities.close(id, broker.agencyId, { outcome: 'lost', lost_reason: 'Went quiet' });

    const reopened = await opportunities.reactivate(id, broker.agencyId);

    expect(reopened.status).toBe('active');
    expect(reopened.closed_at).toBeNull();
    expect(reopened.lost_reason).toBeNull();
  });

  it('pages through the rows with the total that match (AC-6)', async () => {
    const title = `Paging ${crypto.randomUUID()}`;
    await createOpportunity(title);
    await createOpportunity(title);
    await createOpportunity(title);

    const first = await opportunities.listPage(broker.agencyId, { search: title, limit: 2, offset: 0 });
    const second = await opportunities.listPage(broker.agencyId, { search: title, limit: 2, offset: 2 });

    expect(first.total).toBe(3);
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(1);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(3);
  });

  it('keeps another agency from closing the deal', async () => {
    const { id } = await createOpportunity();
    const outsider = await signInAs('broker@beta.bg');

    await expect(
      new OpportunityService(outsider.db).close(id, broker.agencyId, { outcome: 'won' })
    ).rejects.toMatchObject({ code: 'errors.saveFailed' });
    expect((await opportunities.getById(id, broker.agencyId))!.status).toBe('active');
  });
});
