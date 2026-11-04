import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { SearchService } from './service';

describe('SearchService errors', () => {
  it.each(['contacts', 'opportunities', 'inquiries', 'properties'])(
    'a failed %s search is errors.loadFailed',
    async (table) => {
      const { client } = createFakeSupabase({ role: 'broker', failingTables: [table] });

      const error = await new SearchService(client as SupabaseClient).globalSearch('a', 'Ivan').catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );
});

describe('SearchService results', () => {
  const search = async (tables: Record<string, unknown>) => {
    const { client } = createFakeSupabase({ role: 'broker', tables });
    return new SearchService(client as SupabaseClient).globalSearch('a', 'Ivan');
  };

  it('gives a contact a kind for the UI to translate, not English text', async () => {
    const [organization, person] = await search({
      contacts: [
        { id: 'c1', display_name: 'AlphaCorp', type: 'organization' },
        { id: 'c2', display_name: 'Ivan', type: 'person' },
      ],
    });

    expect(organization).toMatchObject({ title: 'AlphaCorp', kind: 'organization', subtitle: null });
    expect(person).toMatchObject({ title: 'Ivan', kind: 'person', subtitle: null });
  });

  it('gives an opportunity its type as the kind', async () => {
    const [opportunity] = await search({ opportunities: [{ id: 'o1', title: 'Flat', type: 'buyer' }] });

    expect(opportunity).toMatchObject({ title: 'Flat', kind: 'buyer', subtitle: null });
  });

  it('leaves the title empty for a caller with no name, for the UI to fill', async () => {
    const [inquiry] = await search({ inquiries: [{ id: 'i1', caller_name: null, subject: 'Office space' }] });

    expect(inquiry).toMatchObject({ title: null, kind: null, subtitle: 'Office space' });
  });
});

describe('SearchService property results', () => {
  it('shows a property by its code, with the address under it', async () => {
    const { client } = createFakeSupabase({
      role: 'broker',
      tables: { properties: [{ id: 'p1', code: 1001, address: 'ул. Кричим 12' }, { id: 'p2', code: 1002, address: null }] },
    });

    const results = await new SearchService(client as SupabaseClient).globalSearch('a', 'Кричим');

    expect(results.filter((result) => result.type === 'property')).toEqual([
      { id: 'p1', type: 'property', title: '#1001', subtitle: 'ул. Кричим 12', kind: null, url: '/properties/p1', relevance: 1 },
      { id: 'p2', type: 'property', title: '#1002', subtitle: null, kind: null, url: '/properties/p2', relevance: 1 },
    ]);
  });
});
