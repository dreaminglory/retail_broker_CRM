import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminClient, createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { getTodayWindows, todayBucket } from '@/lib/time/agency-day';
import { ExceptionsRepository } from '../exceptions/repository';
import { OpportunityService } from '../opportunities/service';
import { TaskService } from '../tasks/service';
import { findBuiltInList, scopedFilter } from './built-in';
import { SmartListRepository } from './repository';
import { SmartListService, type Viewer } from './service';
import type { OpportunityListFilter } from './types';
import { opportunityFilterFromParams } from './url-filter';

// Today reads the agency timezone through the request's Supabase client; the seed uses Sofia.
vi.mock('@/domain/agencies/settings', () => ({
  getAgencySettings: async () => ({ timezone: 'Europe/Sofia', default_currency: 'EUR' }),
}));

const { loadTodayScreenData } = await import('@/app/(dashboard)/today/today-data');

const TZ = 'Europe/Sofia';
const RUN = Date.now().toString(36);

// The suite writes deals and tasks in Beta: the digest suite runs Alpha's digest and counts
// whose is empty, so rows added there while it runs would move its numbers.
describeServices('SmartListService against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let manager: TestSession;
  let stageId: string;

  beforeAll(async () => {
    [broker, manager] = await Promise.all([signInAs('broker@beta.bg'), signInAs('manager@beta.bg')]);
    const { data: stage } = await broker.db
      .from('stages')
      .select('id')
      .eq('agency_id', broker.agencyId)
      .eq('name', 'New')
      .single();
    stageId = stage!.id;
  });

  afterAll(() => cleanup.run());

  async function createDeal(session: TestSession, title: string, assignedTo: string | null = session.userId) {
    const deal = await new OpportunityService(session.db).create(session.agencyId, session.userId, {
      title,
      type: 'buyer',
      stage_id: stageId,
      assigned_to: assignedTo,
    } as never);
    cleanup.track('opportunities', deal.id);
    return deal;
  }

  async function createTask(session: TestSession, opportunityId: string, dueAt: string, assignedTo: string) {
    const task = await new TaskService(session.db, { timezone: TZ }).create(session.agencyId, session.userId, {
      opportunity_id: opportunityId,
      title: `SLC task ${RUN}`,
      task_type: 'call',
      due_at: dueAt,
      assigned_to: assignedTo,
    } as never);
    cleanup.track('tasks', task.id);
    return task;
  }

  function viewerOf(session: TestSession, role: string): Viewer {
    return { userId: session.userId, agencyId: session.agencyId, role };
  }

  async function listIds(session: TestSession, listId: string, scope: 'mine' | 'agency'): Promise<string[]> {
    const { rows, total } = await new SmartListRepository(session.db).listRows(scopedFilter(findBuiltInList(listId)!, scope), {
      limit: 100,
    });
    expect(total, `${listId} fits on one page of 100`).toBeLessThanOrEqual(100);
    return rows.map((r) => r.id).sort();
  }

  /**
   * Other suites write deals while this runs, so the screen the lists are compared with (Today,
   * Exceptions) is read before and after the lists, and only one that didn't move counts.
   */
  async function betweenStableReads<T, L>(readToday: () => Promise<T>, readLists: () => Promise<L>) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const before = await readToday();
      const lists = await readLists();
      const after = await readToday();
      if (JSON.stringify(before) === JSON.stringify(after)) return { today: before, lists };
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('The compared screen kept changing while the lists were read');
  }

  describe('the same numbers as Today, counted by deal (rule 2, AC-1)', () => {
    beforeAll(async () => {
      const w = getTodayWindows(TZ);
      const laterToday = new Date((Date.parse(w.dueToday.from) + Date.parse(w.dueToday.before)) / 2).toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();

      // A deal with a today task behind an overdue one: it is overdue, not due today.
      const both = await createDeal(broker, `SLC overdue then today ${RUN}`);
      await createTask(broker, both.id, twoHoursAgo, broker.userId);
      await createTask(broker, both.id, laterToday, broker.userId);
      // The broker's deal whose only task is the manager's: on the broker's due-today list, on
      // the manager's Today.
      const others = await createDeal(broker, `SLC task for someone else ${RUN}`);
      await createTask(broker, others.id, laterToday, manager.userId);
    });

    /** Today's overdue and due-today tasks of the whole agency, mapped to deals per rule 2. */
    async function todayDealSections(ownerScope: string | null) {
      const today = await loadTodayScreenData({ supabase: manager.db, userId: manager.userId, agencyId: manager.agencyId, role: 'manager' }, 'agency');
      const section = new Map<string, 'overdue' | 'due-today'>();
      for (const t of today.overdue) if (t.opportunity_id) section.set(t.opportunity_id, 'overdue');
      for (const t of today.dueToday) if (t.opportunity_id && !section.has(t.opportunity_id)) section.set(t.opportunity_id, 'due-today');

      const { data: deals, error } = await manager.db
        .from('opportunities')
        .select('id, assigned_to, status')
        .eq('agency_id', manager.agencyId)
        .in('id', [...section.keys()]);
      expect(error).toBeNull();
      const kept = (deals ?? []).filter((d) => d.status === 'active' && (ownerScope === null || d.assigned_to === ownerScope));
      const of = (s: string) => kept.filter((d) => section.get(d.id) === s).map((d) => d.id).sort();
      return { overdue: of('overdue'), dueToday: of('due-today') };
    }

    const cases = [
      { name: 'broker on mine', who: () => broker, role: 'broker', scope: 'mine' as const },
      { name: 'manager on mine', who: () => manager, role: 'manager', scope: 'mine' as const },
      { name: 'manager on agency', who: () => manager, role: 'manager', scope: 'agency' as const },
    ];

    it.each(cases)('no-next-action and new-inquiries equal Today ($name)', async ({ who, role, scope }) => {
      const session = who();
      const { today, lists } = await betweenStableReads(
        async () => {
          const t = await loadTodayScreenData({ supabase: session.db, userId: session.userId, agencyId: session.agencyId, role }, scope);
          return { atRisk: t.atRisk.map((d) => d.id).sort(), newInquiries: t.newInquiries.map((i) => i.id).sort() };
        },
        async () => ({
          overview: await new SmartListService(session.db).overview(viewerOf(session, role), scope),
          atRiskIds: await listIds(session, 'no-next-action', scope),
        })
      );
      expect(lists.overview.scope).toBe(scope);
      const count = (id: string) => lists.overview.builtIn.find((b) => b.list.id === id)!.count;

      expect(count('no-next-action')).toBe(today.atRisk.length);
      expect(count('new-inquiries')).toBe(today.newInquiries.length);
      expect(lists.atRiskIds).toEqual(today.atRisk);
    });

    it.each(cases)('overdue and due-today equal Today mapped to the deals ($name)', async ({ who, role, scope }) => {
      const session = who();
      const { today: expected, lists } = await betweenStableReads(
        () => todayDealSections(scope === 'mine' ? session.userId : null),
        async () => ({
          overview: await new SmartListService(session.db).overview(viewerOf(session, role), scope),
          overdue: await listIds(session, 'overdue', scope),
          dueToday: await listIds(session, 'due-today', scope),
        })
      );
      const count = (id: string) => lists.overview.builtIn.find((b) => b.list.id === id)!.count;

      expect(lists.overdue).toEqual(expected.overdue);
      expect(lists.dueToday).toEqual(expected.dueToday);
      expect(count('overdue')).toBe(expected.overdue.length);
      expect(count('due-today')).toBe(expected.dueToday.length);
    });

    it('the test deals land where rule 2 puts them', async () => {
      const titles = async (id: string) => {
        const { rows } = await new SmartListRepository(broker.db).listRows(
          { entity: 'opportunity', filter: { ...(scopedFilter(findBuiltInList(id)!, 'mine').filter as OpportunityListFilter), search: 'SLC ' } },
          { limit: 100 }
        );
        return rows.map((r) => (r as { title: string }).title).filter((t) => t.endsWith(RUN)).sort();
      };
      expect(await titles('overdue')).toEqual([`SLC overdue then today ${RUN}`]);
      expect(await titles('due-today')).toEqual([`SLC task for someone else ${RUN}`]);
    });
  });

  describe('Agency equals Exceptions where they overlap (AC-1)', () => {
    let staleId: string;

    beforeAll(async () => {
      // Exceptions shows a deal with no next action under "At risk", or under "Stale" once it is
      // untouched for 7 days; the list holds both. The seed has no stale one, so add it (the
      // trigger sets updated_at only on update, so the insert keeps the old date).
      const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
      const { data, error } = await adminClient()
        .from('opportunities')
        .insert({
          agency_id: manager.agencyId,
          title: `SLE stale ${RUN}`,
          type: 'buyer',
          stage_id: stageId,
          assigned_to: broker.userId,
          created_by: manager.userId,
          created_at: tenDaysAgo,
          updated_at: tenDaysAgo,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      staleId = data!.id;
      cleanup.track('opportunities', staleId);
    });

    it('unassigned-inquiries and no-next-action equal the Exceptions page (manager on agency)', async () => {
      const { today: exceptions, lists } = await betweenStableReads(
        async () => {
          const data = await new ExceptionsRepository(manager.db).getDashboardData(manager.agencyId, TZ);
          return {
            unassignedInquiries: data.unassignedInquiries.map((i) => i.id).sort(),
            stale: data.staleOpportunities.map((o) => o.id),
            noNextAction: [...data.atRiskOpportunities, ...data.staleOpportunities].map((o) => o.id).sort(),
          };
        },
        async () => ({
          overview: await new SmartListService(manager.db).overview(viewerOf(manager, 'manager'), 'agency'),
          unassignedInquiries: await listIds(manager, 'unassigned-inquiries', 'agency'),
          noNextAction: await listIds(manager, 'no-next-action', 'agency'),
        })
      );
      const count = (id: string) => lists.overview.builtIn.find((b) => b.list.id === id)!.count;

      expect(exceptions.stale).toContain(staleId);
      expect(exceptions.unassignedInquiries.length).toBeGreaterThan(0);
      expect(lists.unassignedInquiries).toEqual(exceptions.unassignedInquiries);
      expect(count('unassigned-inquiries')).toBe(exceptions.unassignedInquiries.length);
      expect(lists.noNextAction).toEqual(exceptions.noNextAction);
      expect(count('no-next-action')).toBe(exceptions.noNextAction.length);
    });
  });

  describe('the SQL day windows equal getTodayWindows (AD-062)', () => {
    // Around Sofia midnights and both DST switches of 2026 (29 March, 25 October).
    const dueTimes = [
      '2026-03-28T21:59:59.000Z',
      '2026-03-28T22:00:00.000Z',
      '2026-03-31T20:59:59.000Z',
      '2026-03-31T21:00:00.000Z',
      '2026-10-24T21:00:00.000Z',
      '2026-10-25T22:00:00.000Z',
      '2026-10-27T21:59:59.000Z',
      '2026-10-27T22:00:00.000Z',
    ];
    const nows = [
      '2026-03-28T10:00:00.000Z',
      '2026-03-28T21:59:59.000Z',
      '2026-03-28T22:00:00.000Z',
      '2026-10-24T20:59:59.000Z',
      '2026-10-24T21:00:00.000Z',
      '2026-10-23T21:30:00.000Z',
    ];
    const titleOf = (i: number) => `SLW ${RUN} ${i}`;

    beforeAll(async () => {
      for (const [i, due] of dueTimes.entries()) {
        const deal = await createDeal(broker, titleOf(i));
        await createTask(broker, deal.id, due, broker.userId);
      }
    });

    it.each(nows)('at %s every deal is in the section todayBucket gives it', async (now) => {
      const sections = { overdue: 'overdue', today: 'dueToday', upcoming: 'upcoming' } as const;
      for (const [nextAction, bucket] of Object.entries(sections)) {
        const { data, error } = await broker.db.rpc('smart_list_opportunities_at', {
          p_now: now,
          p_filter: { status: ['active'], next_action: nextAction, search: `SLW ${RUN}` },
          p_limit: 100,
          p_offset: 0,
          p_after: null,
        });
        expect(error).toBeNull();
        const got = ((data ?? []) as { title: string }[]).map((r) => r.title).sort();
        const expected = dueTimes
          .map((due, i) => [due, titleOf(i)] as const)
          .filter(([due]) => todayBucket(due, TZ, new Date(now)) === bucket)
          .map(([, title]) => title)
          .sort();
        expect(got, `${nextAction} at ${now}`).toEqual(expected);
      }
    });
  });

  describe('saving', () => {
    it('a 6th has_new_matches list gives the friendly key; the trigger stays behind it', async () => {
      const service = new SmartListService(broker.db);
      const viewer = viewerOf(broker, 'broker');
      const { data: existing } = await broker.db
        .from('smart_lists')
        .select('id')
        .eq('created_by', broker.userId)
        .contains('filter', { has_new_matches: true });
      for (let i = (existing ?? []).length; i < 5; i++) {
        const list = await service.save(viewer, { name: `SLM ${RUN} ${i}`, entity: 'opportunity', filter: { has_new_matches: true } });
        cleanup.track('smart_lists', list.id);
      }

      await expect(
        service.save(viewer, { name: `SLM ${RUN} sixth`, entity: 'opportunity', filter: { has_new_matches: true } })
      ).rejects.toMatchObject({ code: 'smartLists.errors.matchListLimit' });

      // Straight to the table, the trigger refuses it with the same key.
      const { error } = await broker.db.from('smart_lists').insert({
        agency_id: broker.agencyId,
        created_by: broker.userId,
        name: `SLM ${RUN} direct`,
        entity: 'opportunity',
        filter: { has_new_matches: true },
      });
      expect(error?.message).toBe('smartLists.errors.matchListLimit');
    });

    it('a duplicate name gives the duplicateName key', async () => {
      const service = new SmartListService(broker.db);
      const viewer = viewerOf(broker, 'broker');
      const list = await service.save(viewer, { name: `SLD ${RUN}`, entity: 'inquiry', filter: { status: ['new'] } });
      cleanup.track('smart_lists', list.id);
      await expect(
        service.save(viewer, { name: `sld ${RUN}`, entity: 'inquiry', filter: {} })
      ).rejects.toMatchObject({ code: 'smartLists.errors.duplicateName' });
    });

    it('a list saved from the URL counts what the deal list shows; only its creator sees or changes it (AC-4)', async () => {
      const deal = await createDeal(broker, `SLS ${RUN} warm`);
      await broker.db.from('opportunities').update({ temperature: 'warm' }).eq('id', deal.id);
      const service = new SmartListService(broker.db);
      const viewer = viewerOf(broker, 'broker');
      const params = { search: `SLS ${RUN}`, temperature: 'warm', type: 'buyer' };

      const list = await service.save(viewer, { name: `SLS ${RUN}`, entity: 'opportunity', filter: opportunityFilterFromParams(params) });
      cleanup.track('smart_lists', list.id);

      const shown = await new OpportunityService(broker.db).listPage(broker.agencyId, {
        search: params.search, temperature: 'warm', type: 'buyer',
      });
      const overview = await service.overview(viewer);
      expect(overview.saved.find((s) => s.list.id === list.id)?.count).toBe(shown.total);
      expect(shown.total).toBe(1);

      // Another member of the agency, a manager included, neither sees nor changes it.
      const managerView = viewerOf(manager, 'manager');
      const other = new SmartListService(manager.db);
      expect((await other.overview(managerView)).saved.map((s) => s.list.id)).not.toContain(list.id);
      await expect(other.rename(managerView, list.id, 'Taken')).rejects.toMatchObject({ code: 'smartLists.errors.notFound' });
      await expect(other.remove(managerView, list.id)).rejects.toMatchObject({ code: 'smartLists.errors.notFound' });

      // Rename, then widen the filter: the count follows.
      await service.rename(viewer, list.id, `SLS ${RUN} renamed`);
      await service.updateFilter(viewer, list.id, opportunityFilterFromParams({ search: `SLS ${RUN}`, temperature: 'hot' }));
      const after = await service.page(viewer, list.id, undefined);
      expect(after?.list.kind === 'saved' && after.list.list.name).toBe(`SLS ${RUN} renamed`);
      expect(after?.result?.total).toBe(0);

      await service.remove(viewer, list.id);
      expect(await service.page(viewer, list.id, undefined)).toBeNull();
    });
  });

  describe('a member of another agency', () => {
    it('cannot open an Alpha saved list by id (AC-8)', async () => {
      const alpha = await signInAs('manager@alpha.bg');
      const { data: shared } = await alpha.db.from('smart_lists').select('id').eq('shared', true).limit(1).single();
      expect(shared?.id).toBeTruthy();
      const page = await new SmartListService(broker.db).page(viewerOf(broker, 'broker'), shared!.id, undefined);
      expect(page).toBeNull();
    });
  });
});
