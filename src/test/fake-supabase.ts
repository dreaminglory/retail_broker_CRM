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
  /** Tables whose queries fail with a database error. */
  failingTables?: string[];
  /** No session: auth.getUser returns no user. */
  signedOut?: boolean;
}): FakeSupabase {
  const touchedTables: string[] = [];
  const writes: FakeWrite[] = [];
  const filters: FakeFilter[] = [];
  const userId = member.userId ?? 'user-1';
  const agencyId = member.agencyId ?? 'agency-1';

  const chain = (result: { data: unknown; error: { message: string } | null }, table?: string) => {
    const builder: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(builder, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) => resolve(result);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => Promise.resolve({ data: result.error ? null : result.data, error: result.error });
        }
        if (table && typeof prop === 'string' && WRITE_OPS.has(prop)) {
          return (values: unknown) => {
            writes.push({ table, op: prop as FakeWrite['op'], values });
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
      return chain({ data: null, error: null });
    },
  };

  return { client, touchedTables, writes, filters };
}
