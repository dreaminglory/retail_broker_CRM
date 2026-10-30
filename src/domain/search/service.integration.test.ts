import { afterAll, beforeAll, expect, it } from 'vitest';
import { ContactService } from '@/domain/contacts/service';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { SearchService } from './service';

describeServices('SearchService against the local stack', () => {
  const cleanup = createRowCleanup();
  const digits = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const local = `0877 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  const e164 = `+359877${digits}`;
  const name = `Searched${crypto.randomUUID().slice(0, 8)}`;
  let broker: TestSession;
  let contactId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    const contact = await new ContactService(broker.db).create(broker.agencyId, broker.userId, {
      type: 'person',
      first_name: name,
      contact_methods: [{ type: 'phone', value: e164, label: null, is_primary: true }],
    });
    contactId = contact.id;
    cleanup.track('contacts', contact.id);
  });

  afterAll(() => cleanup.run());

  const resultIds = async (session: TestSession, query: string) =>
    (await new SearchService(session.db).globalSearch(session.agencyId, query)).map((result) => result.id);

  it('finds a contact stored in E.164 from a local-format number', async () => {
    expect(await resultIds(broker, local)).toContain(contactId);
  });

  it('finds a contact by the number as stored', async () => {
    expect(await resultIds(broker, e164)).toContain(contactId);
  });

  it('finds a contact by name', async () => {
    expect(await resultIds(broker, name)).toContain(contactId);
  });

  it('returns nothing for a query under two characters', async () => {
    expect(await resultIds(broker, 'S')).toEqual([]);
  });

  it('finds nothing from another agency', async () => {
    const outsider = await signInAs('broker@beta.bg');

    expect(await resultIds(outsider, local)).toEqual([]);
    expect(await resultIds(outsider, name)).toEqual([]);
  });
});
