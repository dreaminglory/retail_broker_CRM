import { afterAll, beforeAll, expect, it } from 'vitest';
import { createRowCleanup, describeServices, signInAs, type TestSession } from '@/test/supabase-test-client';
import { DomainError } from '@/lib/errors';
import { PropertyService } from '@/domain/properties/service';
import { SettlementService } from '@/domain/settlements/service';
import { TimelineService } from '@/domain/timeline/service';
import { NotesService } from './service';

describeServices('Notes on properties against the local stack', () => {
  const cleanup = createRowCleanup();
  let broker: TestSession;
  let outsider: TestSession;
  let propertyId: string;

  beforeAll(async () => {
    broker = await signInAs('broker@alpha.bg');
    outsider = await signInAs('broker@beta.bg');
    const [{ id: sofiaId }] = await new SettlementService(broker.db).search('София', 'bg');
    const property = await new PropertyService(broker.db).create(broker.agencyId, broker.userId, { type: 'garage', settlement_id: sofiaId });
    propertyId = property.id;
    cleanup.track('properties', propertyId);
  });

  afterAll(() => cleanup.run());

  it('adds a note on a property and shows it on its timeline', async () => {
    const note = await new NotesService(broker.db).createNote(broker.agencyId, broker.userId, {
      property_id: propertyId,
      content: 'Keys are with the neighbour',
    });
    cleanup.track('notes', note.id);

    expect(note.property_id).toBe(propertyId);
    const entries = await new TimelineService(broker.db).getPropertyTimeline(propertyId, broker.agencyId);
    const notes = entries.flatMap((entry) => (entry.type === 'note' ? [entry.data.content] : []));
    expect(notes).toEqual(['Keys are with the neighbour']);
  });

  it("refuses a note on another agency's property", async () => {
    const error = await new NotesService(outsider.db)
      .createNote(outsider.agencyId, outsider.userId, { property_id: propertyId, content: 'Sneaky' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('errors.not_found');
    const { data } = await broker.db.from('notes').select('id').eq('property_id', propertyId).eq('content', 'Sneaky');
    expect(data).toEqual([]);
  });
});
