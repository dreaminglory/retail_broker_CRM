import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { SearchService } from './service';

describe('SearchService errors', () => {
  it.each(['contacts', 'opportunities', 'inquiries'])(
    'a failed %s search is errors.loadFailed',
    async (table) => {
      const { client } = createFakeSupabase({ role: 'broker', failingTables: [table] });

      const error = await new SearchService(client as SupabaseClient).globalSearch('a', 'Ivan').catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );
});
