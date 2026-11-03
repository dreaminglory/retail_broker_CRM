import { describe, expect, it } from 'vitest';
import { addPropertyPartySchema } from './validation';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = '22222222-2222-4222-8222-222222222222';

describe('addPropertyPartySchema', () => {
  it('accepts a contact with a role', () => {
    expect(addPropertyPartySchema.parse({ property_id: PROPERTY_ID, contact_id: CONTACT_ID, role: 'co_owner' })).toEqual({
      property_id: PROPERTY_ID,
      contact_id: CONTACT_ID,
      role: 'co_owner',
    });
  });

  it('needs a chosen contact, with an i18n key', () => {
    const result = addPropertyPartySchema.safeParse({ property_id: PROPERTY_ID, contact_id: '', role: 'owner' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['contact_id'], message: 'validation.contact_required' });
  });

  it('refuses an unknown role', () => {
    expect(addPropertyPartySchema.safeParse({ property_id: PROPERTY_ID, contact_id: CONTACT_ID, role: 'tenant' }).success).toBe(false);
  });
});
