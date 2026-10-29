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
};

export function createFakeSupabase(member: {
  userId?: string;
  agencyId?: string;
  role: string;
  /** What a query on a table returns, e.g. the row a `.single()` read gets. */
  tables?: Record<string, unknown>;
}): FakeSupabase {
  const touchedTables: string[] = [];
  const userId = member.userId ?? 'user-1';
  const agencyId = member.agencyId ?? 'agency-1';

  const chain = (result: { data: unknown; error: null }) => {
    const builder: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(builder, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) => resolve(result);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => Promise.resolve({ data: result.data, error: null });
        }
        return () => proxy;
      },
    });
    return proxy;
  };

  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from(table: string) {
      if (table === 'agency_memberships') {
        return chain({ data: { agency_id: agencyId, role: member.role }, error: null });
      }
      touchedTables.push(table);
      return chain({ data: member.tables?.[table] ?? [], error: null });
    },
    rpc(fn: string) {
      touchedTables.push(`rpc:${fn}`);
      return chain({ data: null, error: null });
    },
  };

  return { client, touchedTables };
}
