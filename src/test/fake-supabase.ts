/**
 * A stand-in for the Supabase server client in Server Action tests.
 *
 * It signs in one user with one active membership and records every table a
 * query touches, so a test can assert that a refused action never reached the
 * database. Queries on other tables resolve to the
 * data given in `tables`, or `[]`.
 */
export type FakeSupabase = {
  client: unknown;
  /** Tables queried, other than the membership lookup done by getAuthContext. */
  touchedTables: string[];
  /** Every insert, update, upsert or delete, with the values it was given. */
  writes: FakeWrite[];
  /** Every `.eq(column, value)` filter, by table. */
  filters: FakeFilter[];
};

export type FakeFilter = { table: string; column: string; value: unknown };

export type FakeWrite = { table: string; op: 'insert' | 'update' | 'upsert' | 'delete'; values: unknown };

const WRITE_OPS = new Set(['insert', 'update', 'upsert', 'delete']);

export function createFakeSupabase(member: {
  userId?: string;
  agencyId?: string;
  role: string;
  /** What a query on a table returns, e.g. the row a `.single()` read gets. */
  tables?: Record<string, unknown>;
  /** Tables (or `rpc:<name>`) whose queries fail with a database error. */
  failingTables?: string[];
  /** No session: auth.getUser returns no user. */
  signedOut?: boolean;
  /** Tables whose guarded writes match no row (another user changed it first). */
  writesMatchNothing?: string[];
}): FakeSupabase {
  const touchedTables: string[] = [];
  const writes: FakeWrite[] = [];
  const filters: FakeFilter[] = [];
  const userId = member.userId ?? 'user-1';
  const agencyId = member.agencyId ?? 'agency-1';

  const chain = (result: { data: unknown; error: { code?: string; message: string } | null }, table?: string) => {
    const builder: Record<string, unknown> = {};
    let wrote = false;
    const proxy: unknown = new Proxy(builder, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) => resolve(result);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          if (wrote && table && member.writesMatchNothing?.includes(table)) {
            return () =>
              Promise.resolve(
                prop === 'single'
                  ? { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
                  : { data: null, error: null }
              );
          }
          return () => Promise.resolve({ data: result.error ? null : result.data, error: result.error });
        }
        if (table && typeof prop === 'string' && WRITE_OPS.has(prop)) {
          return (values: unknown) => {
            writes.push({ table, op: prop as FakeWrite['op'], values });
            wrote = true;
            return proxy;
          };
        }
        if (table && prop === 'eq') {
          return (column: string, value: unknown) => {
            filters.push({ table, column, value });
            return proxy;
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  };

  const client = {
    auth: {
      getUser: async () => ({ data: { user: member.signedOut ? null : { id: userId } }, error: null }),
    },
    from(table: string) {
      if (table === 'agency_memberships') {
        return chain({ data: { agency_id: agencyId, role: member.role }, error: null });
      }
      touchedTables.push(table);
      if (member.failingTables?.includes(table)) {
        return chain({ data: null, error: { message: 'connection reset' } }, table);
      }
      return chain({ data: member.tables && table in member.tables ? member.tables[table] : [], error: null }, table);
    },
    rpc(fn: string) {
      touchedTables.push(`rpc:${fn}`);
      if (member.failingTables?.includes(`rpc:${fn}`)) {
        return chain({ data: null, error: { message: 'connection reset' } });
      }
      return chain({ data: null, error: null });
    },
  };

  return { client, touchedTables, writes, filters };
}
