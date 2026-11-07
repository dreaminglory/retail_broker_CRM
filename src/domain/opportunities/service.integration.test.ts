import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { SmartListRepository } from '../smart-lists/repository';
import type { OpportunityListOptions } from './types';
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

  // Task 10: the list reads through smart_list_opportunities. Parity with the PostgREST query it
  // replaced: the expected rows are worked out here from the deals' own fields, with that query's
  // rules (active by default, newest first, id breaking ties). The other suites write Alpha's
  // deals in parallel, so the cases run on deals this suite creates, found by a tag in the title
  // (search is part of every case).
  describe('reads through smart_list_opportunities (parity and the new filters)', () => {
    const tag = `Parity ${crypto.randomUUID().slice(0, 8)}`;
    let manager: TestSession;
    let ids: Record<string, string>;
    type Fixture = {
      id: string;
      status: string;
      type: string;
      temperature: string;
      stage_id: string;
      assigned_to: string | null;
      created_at: string;
    };
    let fixtures: Fixture[];

    /** The rows and order the old PostgREST query gave for these options. */
    function expectedFor(opts: OpportunityListOptions): string[] {
      const status = opts.status ?? 'active';
      return fixtures
        .filter((d) => status === 'all' || d.status === status)
        .filter((d) => !opts.type || opts.type === 'all' || d.type === opts.type)
        .filter((d) => !opts.stageId || opts.stageId === 'all' || d.stage_id === opts.stageId)
        .filter((d) => !opts.temperature || d.temperature === opts.temperature)
        .filter((d) => !opts.assignedTo || d.assigned_to === opts.assignedTo)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
        .map((d) => d.id);
    }
    let ctx: { stageA: string; stageB: string; sourceId: string };

    beforeAll(async () => {
      manager = await signInAs('manager@alpha.bg');
      const admin = adminClient();
      const [{ data: stages }, { data: sources }] = await Promise.all([
        admin.from('stages').select('id').eq('agency_id', manager.agencyId).order('sort_order').limit(2),
        admin.from('lead_sources').select('id').eq('agency_id', manager.agencyId).limit(1),
      ]);
      ctx = { stageA: stages![0].id, stageB: stages![1].id, sourceId: sources![0].id };
      const base = { agency_id: manager.agencyId, created_by: manager.userId };
      const day = 24 * 60 * 60 * 1000;
      const deal = (name: string, extra: Record<string, unknown>) => ({
        ...base,
        title: `${tag} ${name}`,
        stage_id: ctx.stageA,
        type: 'buyer',
        temperature: 'warm',
        assigned_to: null,
        source_id: null,
        status: 'active',
        created_at: new Date().toISOString(),
        ...extra,
      });
      // These share created_at, so their order rests on the id tie-break.
      const now = new Date().toISOString();
      const rowsToInsert = [
        deal('hot buyer', { created_at: now, temperature: 'hot', assigned_to: broker.userId, source_id: ctx.sourceId }),
        deal('seller', { created_at: now, type: 'seller', stage_id: ctx.stageB, assigned_to: manager.userId }),
        deal('won', { created_at: now, status: 'won', temperature: 'cold', assigned_to: broker.userId }),
        deal('lost tenant', { created_at: now, status: 'lost', type: 'tenant', stage_id: ctx.stageB }),
        deal('nurture landlord', { created_at: now, status: 'nurture', type: 'landlord', temperature: 'hot', source_id: ctx.sourceId }),
        deal('archived seller', { created_at: now, status: 'archived', type: 'seller', temperature: 'cold', assigned_to: manager.userId }),
        deal('untouched 20d', { assigned_to: broker.userId, created_at: new Date(Date.now() - 20 * day).toISOString() }),
        deal('untouched 5d', { type: 'seller', temperature: 'hot', created_at: new Date(Date.now() - 5 * day).toISOString() }),
      ];
      const { data: rows, error } = await admin
        .from('opportunities')
        .insert(rowsToInsert)
        .select('id, title, status, type, temperature, stage_id, assigned_to, created_at');
      if (error) throw error;
      // created_at as the database stored it, so ties and order are exact.
      fixtures = rows!.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
      ids = Object.fromEntries(rows!.map((r) => [r.title.slice(tag.length + 1), r.id]));
      for (const r of rows!) cleanup.track('opportunities', r.id);

      // Pending tasks set next_action_at through the tasks trigger: overdue, and in 2 days.
      const task = (opportunity: string, dueInDays: number) => ({
        ...base,
        opportunity_id: ids[opportunity],
        assigned_to: null, // nobody's Today or digest; next_action_at counts every pending task
        title: `${tag} task`,
        due_at: new Date(Date.now() + dueInDays * day).toISOString(),
      });
      const { data: tasks, error: taskError } = await admin
        .from('tasks')
        .insert([task('hot buyer', -1), task('seller', 2)])
        .select('id');
      if (taskError) throw taskError;
      // Tracked after the deals: cleanup runs in reverse, so the tasks go first.
      for (const t of tasks!) cleanup.track('tasks', t.id);
    });

    const parity: [string, () => OpportunityListOptions][] = [
      ['no filter (active)', () => ({})],
      ['every status', () => ({ status: 'all' })],
      ['won', () => ({ status: 'won' })],
      ['lost', () => ({ status: 'lost' })],
      ['nurture', () => ({ status: 'nurture' })],
      ['archived', () => ({ status: 'archived' })],
      ['a stage', () => ({ stageId: ctx.stageB, status: 'all' })],
      ['every stage', () => ({ stageId: 'all' })],
      ['seller', () => ({ type: 'seller' })],
      ['buyer, every status', () => ({ type: 'buyer', status: 'all' })],
      ['a broker', () => ({ assignedTo: broker.userId, status: 'all' })],
      ['hot', () => ({ temperature: 'hot', status: 'all' })],
      ['combined', () => ({ status: 'all', type: 'buyer', temperature: 'warm', assignedTo: broker.userId })],
    ];

    it.each(parity)('%s: same rows and order as before', async (_name, opts) => {
      const expected = expectedFor(opts());

      const page = await new OpportunityService(manager.db).listPage(manager.agencyId, {
        ...opts(),
        search: tag,
        limit: 50,
      });

      expect(expected.length).toBeGreaterThan(0);
      expect(page.total).toBe(expected.length);
      expect(page.rows.map((r) => r.id)).toEqual(expected);
    });

    it('searches the title case-insensitively, anywhere in it', async () => {
      const service = new OpportunityService(manager.db);
      const cases: [string, string[]][] = [
        [`${tag} hot`, ['hot buyer']],
        [`${tag} HOT buyer`, ['hot buyer']],
        [`  ${tag} seller `, ['seller']],
        [`${tag} no such deal`, []],
      ];
      for (const [search, names] of cases) {
        const page = await service.listPage(manager.agencyId, { search, limit: 50 });
        expect(page.rows.map((r) => r.id), search).toEqual(names.map((n) => ids[n]));
      }
    });

    it('treats % and _ in the search as plain characters (list and quick search alike)', async () => {
      const service = new OpportunityService(manager.db);
      for (const search of [`${tag} h_t`, `${tag} %buyer`]) {
        expect((await service.listPage(manager.agencyId, { search, status: 'all', limit: 50 })).total, search).toBe(0);
      }
    });

    it('pages in the same order as before', async () => {
      const second = await new OpportunityService(manager.db).listPage(manager.agencyId, {
        search: tag,
        status: 'all',
        limit: 3,
        offset: 3,
      });

      expect(second.total).toBe(8);
      expect(second.rows.map((r) => r.id)).toEqual(expectedFor({ status: 'all' }).slice(3, 6));
    });

    it('still gives the total for a page past the end, so the pager can fall back', async () => {
      const past = await new OpportunityService(manager.db).listPage(manager.agencyId, {
        search: tag,
        status: 'all',
        limit: 50,
        offset: 100,
      });

      expect(past).toEqual({ rows: [], total: 8 });
    });

    const narrowed: [string, () => OpportunityListOptions, string[]][] = [
      ['source', () => ({ sourceId: ctx.sourceId, status: 'all' }), ['hot buyer', 'nurture landlord']],
      ['no next action', () => ({ nextAction: 'none' }), ['untouched 20d', 'untouched 5d']],
      ['overdue', () => ({ nextAction: 'overdue' }), ['hot buyer']],
      ['upcoming', () => ({ nextAction: 'upcoming' }), ['seller']],
      ['no touch for 14 days', () => ({ noTouchDays: 14 }), ['untouched 20d']],
      ['no touch for 3 days', () => ({ noTouchDays: 3 }), ['untouched 20d', 'untouched 5d']],
      ['combined with the old filters', () => ({ noTouchDays: 3, type: 'seller', temperature: 'hot' }), ['untouched 5d']],
    ];

    it.each(narrowed)('%s narrows to its deals', async (_name, opts, expected) => {
      const page = await new OpportunityService(manager.db).listPage(manager.agencyId, { ...opts(), search: tag, limit: 50 });

      expect(page.rows.map((r) => r.id).sort()).toEqual(expected.map((name) => ids[name]).sort());
      expect(page.total).toBe(expected.length);
    });

    it('has new matches: the same rows as the smart list (on the seed)', async () => {
      const lists = new SmartListRepository(manager.db);
      const service = new OpportunityService(manager.db);
      // Matches need requirements and listings, so this case reads the seed, which the other
      // suites change in parallel: an attempt where the two reads saw different data is retried.
      let expected: string[] = [];
      let actual: string[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const list = await lists.listRows({ entity: 'opportunity', filter: { has_new_matches: true } }, { limit: 50 });
        const page = await service.listPage(manager.agencyId, { hasNewMatches: true, limit: 50 });
        expected = [String(list.total), ...list.rows.map((r) => r.id)];
        actual = [String(page.total), ...page.rows.map((r) => r.id)];
        if (actual.join() === expected.join()) break;
      }

      expect(expected.length).toBeGreaterThan(1);
      expect(actual).toEqual(expected);
    });
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
