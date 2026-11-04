import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';

let fake: FakeSupabase;

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: async () => fake.client,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string) => key, { has: () => true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

// Shared by the contact, opportunity and property pages (NotesActivity).
const { updateNoteAction, deleteNoteAction } = await import('./actions');

const NOTE_ID = '33333333-3333-4333-8333-333333333333';

describe('shared note actions', () => {
  beforeEach(() => {
    fake = createFakeSupabase({ role: 'broker' });
  });

  it('refuses blanking a note without writing it', async () => {
    const form = new FormData();
    form.set('content', '   ');

    const result = await updateNoteAction(NOTE_ID, { success: true, data: undefined }, form);

    expect(result).toMatchObject({ success: false, fieldErrors: { content: ['validation.content_required'] } });
    expect(fake.touchedTables).not.toContain('notes');
  });

  it('deletes a note', async () => {
    expect(await deleteNoteAction(NOTE_ID, '/properties/x')).toEqual({ success: true, data: undefined });
    expect(fake.touchedTables).toContain('notes');
  });
});
