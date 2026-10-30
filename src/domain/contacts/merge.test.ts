import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { ContactMergeService } from './merge';

const CONTACT = { id: 'contact-1', display_name: 'Ivan', contact_methods: [] };

function serviceWith(options: Partial<Parameters<typeof createFakeSupabase>[0]>) {
  const { client } = createFakeSupabase({ role: 'manager', tables: { contacts: CONTACT }, ...options });
  return new ContactMergeService(client as SupabaseClient);
}

describe('ContactMergeService.merge errors', () => {
  it('a failed merge is a translated error, and never partly done', async () => {
    const service = serviceWith({
      failingTables: ['rpc:merge_contacts'],
    });

    const error = await service.merge('agency-1', 'winner', 'loser').catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.saveFailed');
  });

  it('a refusal the RPC raises keeps its i18n key', async () => {
    const service = serviceWith({
      rpcErrors: { merge_contacts: { code: 'P0001', message: 'errors.forbidden' } },
    });

    await expect(service.merge('agency-1', 'winner', 'loser')).rejects.toMatchObject({ code: 'errors.forbidden' });
  });
});

describe('ContactMergeService.getPreview errors', () => {
  it.each(['opportunities', 'inquiries', 'tasks'])(
    'a failed %s count is an error, not "nothing to transfer"',
    async (table) => {
      const error = await serviceWith({ failingTables: [table] })
        .getPreview('agency-1', 'winner', 'loser')
        .catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );
});
