import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/lib/errors';
import { createFakeSupabase } from '@/test/fake-supabase';
import { TimelineService } from './service';

function failingOn(table: string) {
  const { client } = createFakeSupabase({ role: 'broker', failingTables: [table] });
  return new TimelineService(client as SupabaseClient);
}

describe('TimelineService errors', () => {
  it.each(['opportunities', 'opportunity_participants', 'notes', 'tasks', 'audit_log', 'inquiries'])(
    'a failed %s read on a contact is a translated error, not the database message',
    async (table) => {
      const error = await failingOn(table).getContactTimeline('contact-1', 'agency-1').catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );

  it.each(['notes', 'tasks', 'audit_log'])(
    'a failed %s read on an opportunity is a translated error',
    async (table) => {
      const error = await failingOn(table).getOpportunityTimeline('opp-1', 'agency-1').catch((e) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('errors.loadFailed');
    }
  );
});
