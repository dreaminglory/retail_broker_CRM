import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { findPotentialDuplicates } from './duplicate-detection';

const INPUT = {
  type: 'person' as const,
  first_name: 'Ivan',
  last_name: 'Petrov',
  contact_methods: [{ type: 'phone' as const, value: '+359888123456', label: null, is_primary: true }],
};

describe('findPotentialDuplicates errors', () => {
  it.each(['contact_methods', 'contacts'])('a failed %s read is an error, not "no duplicates"', async (table) => {
    const { client } = createFakeSupabase({
      role: 'broker',
      tables: { contact_methods: [{ contact_id: 'contact-1', type: 'phone' }] },
      failingTables: [table],
    });

    const error = await findPotentialDuplicates(client as SupabaseClient, 'agency-1', INPUT).catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.loadFailed');
  });

  it('a failed name search is an error when the caller has no phone or email', async () => {
    const { client } = createFakeSupabase({ role: 'broker', failingTables: ['contacts'] });

    const error = await findPotentialDuplicates(client as SupabaseClient, 'agency-1', {
      ...INPUT,
      contact_methods: [],
    }).catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.loadFailed');
  });
});
