/**
 * Real Supabase clients for service integration tests (AD-043).
 *
 * The suites run against the local stack as the seeded users, so RLS and triggers apply as they
 * do in the app. Without SUPABASE_TEST_URL they skip: `npm run test:services` sets it.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe } from 'vitest';

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];
const SEEDED_PASSWORD = 'password123';

export type SeededLogin = `${'owner' | 'manager' | 'broker'}@${'alpha' | 'beta'}.bg`;

export type TestSession = { db: SupabaseClient; userId: string; agencyId: string };

export const describeServices = describe.skipIf(!process.env.SUPABASE_TEST_URL);

/** The suites sign in with the seeded password and delete rows, so a hosted project is refused. */
export function assertLocalUrl(url: string): void {
  if (!LOCAL_HOSTS.includes(new URL(url).hostname)) {
    throw new Error(`Service tests only run against a local stack, not ${url}`);
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run the suites with npm run test:services.`);
  return value;
}

function newClient(key: string): SupabaseClient {
  const url = env('SUPABASE_TEST_URL');
  assertLocalUrl(url);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function signInAs(email: SeededLogin): Promise<TestSession> {
  const db = newClient(env('SUPABASE_TEST_ANON_KEY'));

  const { data, error } = await db.auth.signInWithPassword({ email, password: SEEDED_PASSWORD });
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`);

  const { data: membership, error: membershipError } = await db
    .from('agency_memberships')
    .select('agency_id')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .single();
  if (membershipError) throw new Error(`${email} has no active membership: ${membershipError.message}`);

  return { db, userId: data.user.id, agencyId: membership.agency_id };
}

/** Each suite tracks the rows it creates, and removes them with the service role afterwards. */
export function createRowCleanup() {
  const rows: { table: string; id: string }[] = [];

  return {
    track(table: string, id: string | null | undefined): void {
      if (id) rows.push({ table, id });
    },
    async run(): Promise<void> {
      if (rows.length === 0) return;
      const admin = newClient(env('SUPABASE_TEST_SERVICE_ROLE_KEY'));
      for (const { table, id } of rows.splice(0).reverse()) {
        const { error } = await admin.from(table).delete().eq('id', id);
        if (error) throw new Error(`Cleanup of ${table} ${id} failed: ${error.message}`);
      }
    },
  };
}

/** The service-role client, for what the app does through the admin client: setup and the cron route. */
export function adminClient(): SupabaseClient {
  return newClient(env('SUPABASE_TEST_SERVICE_ROLE_KEY'));
}
