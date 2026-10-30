import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const MESSAGES: Record<string, string> = {
  'validation.required': 'Задължително',
  'validation.failed': 'Проверете полетата',
  'errors.unexpected': 'Нещо се обърка',
};

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServer: async () => ({}) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () =>
    Object.assign((key: string) => MESSAGES[key] ?? key, { has: (key: string) => key in MESSAGES }),
}));

const { toActionError } = await import('./actions');

describe('toActionError', () => {
  it('translates a Zod message that is an i18n key', async () => {
    const parsed = z.object({ name: z.string().min(1, 'validation.required') }).safeParse({ name: '' });

    const result = await toActionError(parsed.error);

    expect(result.fieldErrors?.name).toEqual(['Задължително']);
  });

  it("never shows Zod's default English message", async () => {
    const parsed = z.object({ name: z.string().max(3), id: z.string().uuid() }).safeParse({ name: 'abcd', id: 'x' });

    const result = await toActionError(parsed.error);

    expect(result.fieldErrors?.name).toEqual(['Проверете полетата']);
    expect(result.fieldErrors?.id).toEqual(['Проверете полетата']);
  });

  it("never shows Zod's default English form error", async () => {
    const parsed = z.string().max(3).safeParse('abcd');

    const result = await toActionError(parsed.error);

    expect(result.error).toBe('Проверете полетата');
  });

  it('hides the message of an unknown error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await toActionError(new Error('duplicate key value violates constraint'));

    expect(result.error).toBe('Нещо се обърка');
    consoleError.mockRestore();
  });
});
