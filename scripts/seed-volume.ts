/**
 * Volume seed for the local stack (spec: trustworthy-loop, Task 6).
 * Adds 2,000 contacts (each with a phone) and 300 opportunities to Alpha Imoti.
 * Refuses to run unless the Supabase URL is local. Safe to run again: ids are
 * deterministic and existing rows are left alone.
 *
 *   npx supabase db reset && npm run seed:volume
 */
import { createClient } from "@supabase/supabase-js";

const CONTACTS = 2000;
const OPPORTUNITIES = 300;
const CHUNK = 500;
const AGENCY_ID = "11111111-1111-1111-1111-111111111111"; // Alpha Imoti (supabase/seed.sql)
const BROKERS = [
  "11111111-2222-2222-2222-222222222222", // owner
  "11111111-3333-3333-3333-333333333333", // manager
  "11111111-4444-4444-4444-444444444444", // broker
];
const TYPES = ["buyer", "seller", "landlord", "tenant"] as const;
const TEMPERATURES = ["hot", "warm", "cold"] as const;
const STATUSES = ["active", "active", "active", "won", "lost", "nurture"] as const;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function isLocal(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

if (!isLocal(url)) {
  console.error(`seed-volume: refusing to run against "${url || "(unset)"}". Local stack only.`);
  process.exit(1);
}
if (!serviceKey) {
  console.error("seed-volume: SUPABASE_SERVICE_ROLE_KEY is not set (run npm run stack:up).");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const pad = (n: number, width: number) => String(n).padStart(width, "0");
const contactId = (n: number) => `aaaaaaaa-0000-4000-8000-${pad(n, 12)}`;
const methodId = (n: number) => `bbbbbbbb-0000-4000-8000-${pad(n, 12)}`;
const opportunityId = (n: number) => `cccccccc-0000-4000-8000-${pad(n, 12)}`;

async function insertChunks(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db
      .from(table)
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function count(table: string, idPrefix: string): Promise<number> {
  const { count: n, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("agency_id", AGENCY_ID)
    .gte("id", `${idPrefix}-0000-4000-8000-000000000000`)
    .lte("id", `${idPrefix}-0000-4000-8000-999999999999`);
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
}

async function main() {
  const { data: stages, error: stageError } = await db
    .from("stages")
    .select("id, is_terminal, terminal_type")
    .eq("agency_id", AGENCY_ID)
    .order("sort_order");
  if (stageError || !stages?.length) {
    throw new Error(`no stages for Alpha Imoti: ${stageError?.message ?? "run npx supabase db reset"}`);
  }

  // Open opportunities sit in open stages; won/lost/nurture ones in the matching terminal stage.
  const openStages = stages.filter((s) => !s.is_terminal);
  const stageFor = (status: string, i: number) =>
    status === "active"
      ? openStages[i % openStages.length]
      : (stages.find((s) => s.terminal_type === status) ?? openStages[0]);

  const contacts = Array.from({ length: CONTACTS }, (_, i) => {
    const n = i + 1;
    return {
      id: contactId(n),
      agency_id: AGENCY_ID,
      type: "person",
      first_name: "Volume",
      last_name: `Contact ${pad(n, 4)}`,
      display_name: `Volume Contact ${pad(n, 4)}`,
    };
  });
  const methods = contacts.map((c, i) => ({
    id: methodId(i + 1),
    agency_id: AGENCY_ID,
    contact_id: c.id,
    type: "phone",
    value: `+3598${pad(10000000 + i, 8)}`,
    is_primary: true,
  }));
  const opportunities = Array.from({ length: OPPORTUNITIES }, (_, i) => {
    const n = i + 1;
    const status = STATUSES[i % STATUSES.length];
    return {
      id: opportunityId(n),
      agency_id: AGENCY_ID,
      title: `Volume Opportunity ${pad(n, 3)}`,
      type: TYPES[i % TYPES.length],
      stage_id: stageFor(status, i).id,
      primary_contact_id: contactId(n),
      assigned_to: BROKERS[i % BROKERS.length],
      temperature: TEMPERATURES[i % TEMPERATURES.length],
      status,
      expected_value: 50000 + (i % 40) * 5000,
    };
  });

  await insertChunks("contacts", contacts);
  await insertChunks("contact_methods", methods);
  await insertChunks("opportunities", opportunities);

  console.log(
    `seed-volume: ${await count("contacts", "aaaaaaaa")} contacts, ` +
      `${await count("opportunities", "cccccccc")} opportunities in Alpha Imoti.`
  );
}

main().catch((err) => {
  console.error(`seed-volume: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
