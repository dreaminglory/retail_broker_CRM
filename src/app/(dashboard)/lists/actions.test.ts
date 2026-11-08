import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

const lists = { save: vi.fn(), rename: vi.fn(), updateFilter: vi.fn(), remove: vi.fn() };
const revalidatePath = vi.fn();

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: async () => fake.client }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
vi.mock('@/domain/smart-lists/service', () => ({
  SmartListService: class {
    save = lists.save;
    rename = lists.rename;
    updateFilter = lists.updateFilter;
    remove = lists.remove;
  },
}));

const { saveListAction, renameListAction, updateListFilterAction, deleteListAction } = await import('./actions');

const ME = 'user-1';
const LIST_ID = '6f1c2b0e-8c1a-4a57-9f3e-1d2c3b4a5f60';
const viewer = { userId: ME, agencyId: 'agency-1', role: 'broker' };

beforeEach(() => {
  vi.clearAllMocks();
  fake = createFakeSupabase({ role: 'broker', userId: ME, agencyId: 'agency-1' });
  lists.save.mockResolvedValue({ id: LIST_ID });
  lists.rename.mockResolvedValue({ id: LIST_ID });
  lists.updateFilter.mockResolvedValue({ id: LIST_ID });
  lists.remove.mockResolvedValue(undefined);
});

describe('saveListAction', () => {
  it('saves the opportunity list URL filters as a personal list', async () => {
    const result = await saveListAction({
      name: 'Warm buyers',
      entity: 'opportunity',
      params: { type: 'buyer', temperature: 'warm', page: '2' },
    });

    expect(result).toEqual({ success: true, data: { id: LIST_ID } });
    expect(lists.save).toHaveBeenCalledWith(expect.objectContaining(viewer), {
      name: 'Warm buyers',
      entity: 'opportunity',
      filter: { status: ['active'], type: ['buyer'], temperature: ['warm'], sort: 'created_desc' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/lists');
  });

  it('returns the service refusal as an i18n message, without throwing', async () => {
    lists.save.mockRejectedValue(new DomainError('smartLists.errors.duplicateName'));
    expect(await saveListAction({ name: 'Dup', entity: 'opportunity', params: {} })).toEqual({
      success: false,
      error: 'smartLists.errors.duplicateName',
    });
  });

  it('refuses a malformed input before the service', async () => {
    const result = await saveListAction({ name: 'X', entity: 'contact', params: {} } as never);
    expect(result.success).toBe(false);
    expect(lists.save).not.toHaveBeenCalled();
  });

  it('a signed-out caller gets the unauthorized error', async () => {
    fake = createFakeSupabase({ role: 'broker', signedOut: true });
    expect(await saveListAction({ name: 'X', entity: 'opportunity', params: {} })).toEqual({
      success: false,
      error: 'errors.unauthorized',
    });
  });
});

describe('renameListAction, updateListFilterAction, deleteListAction', () => {
  it('renames and refreshes the overview and the list', async () => {
    expect(await renameListAction({ id: LIST_ID, name: 'Hot' })).toEqual({ success: true, data: undefined });
    expect(lists.rename).toHaveBeenCalledWith(expect.objectContaining(viewer), LIST_ID, 'Hot');
    expect(revalidatePath).toHaveBeenCalledWith('/lists');
    expect(revalidatePath).toHaveBeenCalledWith(`/lists/${LIST_ID}`);
  });

  it('updates the filter from the URL the list page shows', async () => {
    await updateListFilterAction({ id: LIST_ID, entity: 'opportunity', params: { status: 'all', next: 'none' } });
    expect(lists.updateFilter).toHaveBeenCalledWith(
      expect.objectContaining(viewer),
      LIST_ID,
      expect.objectContaining({ next_action: 'none', sort: 'created_desc' })
    );
  });

  it('deletes', async () => {
    expect(await deleteListAction({ id: LIST_ID })).toEqual({ success: true, data: undefined });
    expect(lists.remove).toHaveBeenCalledWith(expect.objectContaining(viewer), LIST_ID);
  });

  it('a refused change comes back as the forbidden message', async () => {
    lists.remove.mockRejectedValue(new DomainError('errors.forbidden'));
    expect(await deleteListAction({ id: LIST_ID })).toEqual({ success: false, error: 'errors.forbidden' });
  });

  it('refuses an id that is not a uuid', async () => {
    expect((await renameListAction({ id: 'x', name: 'Hot' })).success).toBe(false);
    expect(lists.rename).not.toHaveBeenCalled();
  });
});
