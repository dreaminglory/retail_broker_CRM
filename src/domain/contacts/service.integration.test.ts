import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { ContactService } from './service';

describeServices('ContactService lists against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let contacts: ContactService;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    contacts = new ContactService(broker.db);
  });

  afterAll(() => cleanup.run());

  async function createContact(firstName: string) {
    const contact = await contacts.create(broker.agencyId, broker.userId, { type: 'person', first_name: firstName });
    cleanup.track('contacts', contact.id);
    return contact;
  }

  it('pages through the rows with the total that match (AC-6)', async () => {
    const name = `Paged${crypto.randomUUID().slice(0, 8)}`;
    await createContact(name);
    await createContact(name);
    await createContact(name);

    const first = await contacts.listPage(broker.agencyId, { search: name, limit: 2, offset: 0 });
    const second = await contacts.listPage(broker.agencyId, { search: name, limit: 2, offset: 2 });

    expect(first.total).toBe(3);
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(1);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(3);
  });

  it('finds a contact for the picker, leaving out archived ones (AC-5)', async () => {
    const name = `Picked${crypto.randomUUID().slice(0, 8)}`;
    const active = await createContact(name);
    const archived = await createContact(name);
    await contacts.archive(archived.id, broker.agencyId);

    const options = await contacts.searchForPicker(broker.agencyId, name);

    expect(options.map((option) => option.id)).toEqual([active.id]);
  });

  it('treats % in a picker search as text', async () => {
    const name = `Percent${crypto.randomUUID().slice(0, 8)}`;
    await createContact(name);

    expect(await contacts.searchForPicker(broker.agencyId, 'Percent%')).toEqual([]);
  });

  it('keeps another agency out of the picker and of lookups by id', async () => {
    const name = `Foreign${crypto.randomUUID().slice(0, 8)}`;
    const contact = await createContact(name);
    const outsider = await signInAs('broker@beta.bg');
    const outsiderContacts = new ContactService(outsider.db);

    expect(await outsiderContacts.searchForPicker(outsider.agencyId, name)).toEqual([]);
    expect(await outsiderContacts.getByIds([contact.id], outsider.agencyId)).toEqual([]);
    expect(await contacts.getByIds([contact.id], outsider.agencyId)).toEqual([]);
    expect((await contacts.getByIds([contact.id], broker.agencyId)).map((row) => row.id)).toEqual([contact.id]);
  });
});
