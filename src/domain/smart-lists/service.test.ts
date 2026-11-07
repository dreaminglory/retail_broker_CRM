import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import bg from '../../../messages/bg.json';
import en from '../../../messages/en.json';
import type { SmartList } from './types';

const repo = {
  findVisible: vi.fn(),
  findById: vi.fn(),
  counts: vi.fn(),
  listRows: vi.fn(),
  countByMember: vi.fn(),
  insert: vi.fn(),
};
const profiles = { getProfilesByIds: vi.fn() };

vi.mock('./repository', () => ({ SmartListRepository: vi.fn(function () { return repo; }) }));
vi.mock('../profiles/repository', () => ({ ProfileRepository: vi.fn(function () { return profiles; }) }));

const { SmartListService, MAX_MATCH_LISTS_PER_MEMBER } = await import('./service');

const broker = { userId: 'u-broker', agencyId: 'a-1', role: 'broker' };
const manager = { userId: 'u-manager', agencyId: 'a-1', role: 'manager' };
const LIST_ID = '6f1c2b0e-8c1a-4a57-9f3e-1d2c3b4a5f60';

function savedList(overrides: Partial<SmartList> = {}): SmartList {
  return {
    id: LIST_ID,
    agency_id: 'a-1',
    created_by: 'u-broker',
    name: 'My hot deals',
    entity: 'opportunity',
    filter: { temperature: ['hot'], assigned_to: 'me' },
    shared: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

/** The counts call answers 1, 2, 3… in request order. */
function countInOrder() {
  repo.counts.mockImplementation(async (items: { key: string }[]) => new Map(items.map((it, i) => [it.key, i + 1])));
}

let service: InstanceType<typeof SmartListService>;

beforeEach(() => {
  vi.clearAllMocks();
  repo.findVisible.mockResolvedValue([]);
  profiles.getProfilesByIds.mockResolvedValue(new Map());
  countInOrder();
  service = new SmartListService({} as SupabaseClient);
});

describe('overview', () => {
  it('a broker gets seven lists on mine, without the unassigned ones, even when asking for agency', async () => {
    const overview = await service.overview(broker, 'agency');

    expect(overview.scope).toBe('mine');
    expect(overview.canSwitchScope).toBe(false);
    expect(overview.builtIn.map((b) => b.list.id)).not.toContain('unassigned-deals');
    expect(overview.builtIn).toHaveLength(7);
    const sent = repo.counts.mock.calls[0][0] as { key: string; filter: { assigned_to?: string } }[];
    expect(sent.every((item) => item.filter.assigned_to === 'me')).toBe(true);
  });

  it('a manager gets nine lists and the agency scope drops assigned_to except on unassigned lists', async () => {
    const overview = await service.overview(manager, 'agency');

    expect(overview.scope).toBe('agency');
    expect(overview.canSwitchScope).toBe(true);
    expect(overview.builtIn).toHaveLength(9);
    const sent = repo.counts.mock.calls[0][0] as { key: string; filter: { assigned_to?: string } }[];
    const assigned = Object.fromEntries(sent.map((s) => [s.key, s.filter.assigned_to]));
    expect(assigned['overdue']).toBeUndefined();
    expect(assigned['unassigned-deals']).toBe('unassigned');
    expect(assigned['unassigned-inquiries']).toBe('unassigned');
  });

  it('a manager on mine gets the counts for their own deals', async () => {
    const overview = await service.overview(manager, undefined);
    expect(overview.scope).toBe('mine');
    const sent = repo.counts.mock.calls[0][0] as { key: string; filter: { assigned_to?: string } }[];
    expect(sent.find((s) => s.key === 'no-next-action')!.filter.assigned_to).toBe('me');
  });

  it('counts saved lists as stored, marks a stale one and names who shared a list', async () => {
    repo.findVisible.mockResolvedValue([
      savedList({ id: 'l-own' }),
      savedList({ id: 'l-stale', name: 'Old', filter: { stage: 'New' } }),
      savedList({ id: 'l-shared', name: 'Team', created_by: 'u-manager', shared: true, filter: { next_action: 'overdue' } }),
    ]);
    profiles.getProfilesByIds.mockResolvedValue(new Map([['u-manager', { display_name: 'Maria' }]]));

    const overview = await service.overview(broker);

    const sent = repo.counts.mock.calls[0][0] as { key: string; filter: unknown }[];
    expect(sent.map((s) => s.key)).not.toContain('l-stale');
    expect(sent.find((s) => s.key === 'l-shared')!.filter).toEqual({ next_action: 'overdue' });
    expect(overview.saved.map((s) => [s.list.id, s.count === null, s.sharedBy])).toEqual([
      ['l-own', false, null],
      ['l-stale', true, null],
      ['l-shared', false, 'Maria'],
    ]);
    expect(profiles.getProfilesByIds).toHaveBeenCalledWith(['u-manager']);
  });

  it('asks for the counts in chunks of at most 100 lists', async () => {
    repo.findVisible.mockResolvedValue(
      Array.from({ length: 120 }, (_, i) => savedList({ id: `l-${i}`, name: `List ${i}`, shared: true, created_by: `u-${i}` }))
    );

    const overview = await service.overview(manager, 'agency');

    expect(repo.counts).toHaveBeenCalledTimes(2);
    expect(repo.counts.mock.calls.map((c) => (c[0] as unknown[]).length)).toEqual([100, 29]);
    expect(overview.saved.every((s) => typeof s.count === 'number')).toBe(true);
  });
});

describe('resolve and page', () => {
  it('a broker cannot open an agency-only list; a manager can', async () => {
    expect(await service.page(broker, 'unassigned-deals', undefined)).toBeNull();
    repo.listRows.mockResolvedValue({ entity: 'opportunity', rows: [], total: 0 });
    expect(await service.page(manager, 'unassigned-deals', undefined)).not.toBeNull();
  });

  it('an unknown id or an invisible saved list gives null', async () => {
    expect(await service.page(broker, 'nope', undefined)).toBeNull();
    repo.findById.mockResolvedValue(null);
    expect(await service.page(broker, LIST_ID, undefined)).toBeNull();
    expect(repo.findById).toHaveBeenCalledWith('a-1', LIST_ID);
  });

  it('pages by 20 with the scoped filter', async () => {
    repo.listRows.mockResolvedValue({ entity: 'opportunity', rows: [], total: 41 });

    const page = await service.page(manager, 'overdue', 'agency', 3);

    expect(page).toMatchObject({ scope: 'agency', page: 3, pageSize: 20, result: { total: 41 } });
    expect(repo.listRows).toHaveBeenCalledWith(
      { entity: 'opportunity', filter: { status: ['active'], next_action: 'overdue', sort: 'next_action_asc' } },
      { limit: 20, offset: 40 }
    );
  });

  it('a page past the end loads the last page instead (rows left the list meanwhile)', async () => {
    repo.listRows
      .mockResolvedValueOnce({ entity: 'opportunity', rows: [], total: 25 })
      .mockResolvedValueOnce({ entity: 'opportunity', rows: [{ id: 'd-21' }], total: 25 });

    const page = await service.page(broker, 'overdue', undefined, 4);

    expect(page).toMatchObject({ page: 2, result: { total: 25, rows: [{ id: 'd-21' }] } });
    expect(repo.listRows).toHaveBeenLastCalledWith(expect.anything(), { limit: 20, offset: 20 });
  });

  it('a bad page number falls back to the first page', async () => {
    repo.listRows.mockResolvedValue({ entity: 'inquiry', rows: [], total: 0 });
    const page = await service.page(broker, 'new-inquiries', undefined, -2);
    expect(page!.page).toBe(1);
    expect(repo.listRows).toHaveBeenCalledWith(expect.anything(), { limit: 20, offset: 0 });
  });

  it('a saved list whose filter no longer parses has no result (rule 5)', async () => {
    repo.findById.mockResolvedValue(savedList({ filter: { stage: 'New' } }));
    const page = await service.page(broker, LIST_ID, undefined);
    expect(page).toMatchObject({ list: { kind: 'saved', filter: null }, result: null });
    expect(repo.listRows).not.toHaveBeenCalled();
  });
});

describe('next', () => {
  it('asks for the one row after the current key and says when the list is done', async () => {
    repo.listRows.mockResolvedValueOnce({ entity: 'opportunity', rows: [{ id: 'd-2' }], total: 4 });
    expect(await service.next(broker, 'no-next-action', undefined, [10, 'd-1'])).toEqual({ nextId: 'd-2', total: 4 });
    expect(repo.listRows).toHaveBeenCalledWith(
      { entity: 'opportunity', filter: { status: ['active'], next_action: 'none', sort: 'last_touch_asc', assigned_to: 'me' } },
      { limit: 1, after: [10, 'd-1'] }
    );

    repo.listRows.mockResolvedValueOnce({ entity: 'opportunity', rows: [], total: 0 });
    expect(await service.next(broker, 'no-next-action', undefined, [11, 'd-9'])).toEqual({ nextId: null, total: 0 });
  });

  it('gives null for a list the viewer cannot open', async () => {
    expect(await service.next(broker, 'unassigned-deals', undefined, null)).toBeNull();
  });
});

describe('save', () => {
  beforeEach(() => {
    repo.countByMember.mockResolvedValue({ total: 3, matchLists: 0 });
    repo.insert.mockImplementation(async (_a: string, _u: string, input: object) => savedList(input));
  });

  it('saves a personal list with the parsed name and filter', async () => {
    await service.save(broker, { name: '  Warm buyers ', entity: 'opportunity', filter: { temperature: ['warm'] } });
    expect(repo.insert).toHaveBeenCalledWith('a-1', 'u-broker', {
      name: 'Warm buyers',
      entity: 'opportunity',
      filter: { temperature: ['warm'] },
      shared: false,
    });
  });

  it('refuses a 6th has_new_matches list with the friendly key before the trigger', async () => {
    repo.countByMember.mockResolvedValue({ total: 5, matchLists: MAX_MATCH_LISTS_PER_MEMBER });
    await expect(
      service.save(broker, { name: 'More matches', entity: 'opportunity', filter: { has_new_matches: true } })
    ).rejects.toMatchObject({ code: 'smartLists.errors.matchListLimit' });
    expect(repo.insert).not.toHaveBeenCalled();

    // Lists without new matches are not held to that cap.
    await service.save(broker, { name: 'Plain', entity: 'opportunity', filter: { type: ['buyer'] } });
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });

  it('refuses the 51st list', async () => {
    repo.countByMember.mockResolvedValue({ total: 50, matchLists: 0 });
    await expect(service.save(broker, { name: 'One more', entity: 'inquiry', filter: {} })).rejects.toMatchObject({
      code: 'smartLists.errors.limit',
    });
  });

  it('refuses a no_touch_days that is not a whole number of at least 1, and an unknown entity', async () => {
    for (const no_touch_days of [0, 1.5, '7']) {
      await expect(
        service.save(broker, { name: 'Bad', entity: 'opportunity', filter: { no_touch_days } })
      ).rejects.toHaveProperty('name', 'ZodError');
    }
    await expect(
      service.save(broker, { name: 'Bad', entity: 'contact' as never, filter: {} })
    ).rejects.toMatchObject({ code: 'smartLists.errors.invalidEntity' });
    expect(repo.insert).not.toHaveBeenCalled();
  });
});

describe('messages', () => {
  it('every smartLists error the SQL or the service raises is in both message files', () => {
    const keys = ['limit', 'matchListLimit', 'duplicateName', 'invalidEntity', 'invalidLists', 'tooManyLists', 'immutable'];
    for (const key of keys) {
      expect((en.smartLists.errors as Record<string, string>)[key], key).toBeTruthy();
      expect((bg.smartLists.errors as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
