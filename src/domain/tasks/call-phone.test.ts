import { describe, expect, it } from 'vitest';
import { callPhoneFor } from './call-phone';

const method = (type: string, value: string, is_primary = false) => ({ type, value, is_primary });

describe('callPhoneFor (spec phone-loop rule 1, Today call tasks)', () => {
  it("uses the contact's primary phone", () => {
    const row = {
      contact: {
        display_name: 'Ivan Petrov',
        contact_methods: [method('phone', '+35929876543'), method('phone', '+359888123456', true), method('email', 'a@b.bg', true)],
      },
      inquiry: { caller_name: 'Caller', caller_phone: '+359877000000' },
    };
    expect(callPhoneFor(row)).toEqual({ value: '+359888123456', type: 'phone', name: 'Ivan Petrov' });
  });

  it('falls back to any phone, then a saved Viber or WhatsApp method', () => {
    expect(callPhoneFor({ contact: { display_name: 'A', contact_methods: [method('email', 'a@b.bg'), method('phone', '+35929876543')] } }))
      .toEqual({ value: '+35929876543', type: 'phone', name: 'A' });
    expect(callPhoneFor({ contact: { display_name: 'A', contact_methods: [method('viber', '+359888123456')] } }))
      .toEqual({ value: '+359888123456', type: 'viber', name: 'A' });
  });

  it("uses the deal's primary contact when the task has no contact or it has no phone", () => {
    const dealContact = { display_name: 'Deal Person', contact_methods: [method('phone', '+359888999000', true)] };
    expect(callPhoneFor({ contact: null, dealContact })).toEqual({ value: '+359888999000', type: 'phone', name: 'Deal Person' });
    expect(callPhoneFor({ contact: { display_name: 'A', contact_methods: [] }, dealContact }))
      .toEqual({ value: '+359888999000', type: 'phone', name: 'Deal Person' });
    expect(callPhoneFor({ contact: { display_name: 'A', contact_methods: [method('phone', '+35929876543')] }, dealContact }))
      .toEqual({ value: '+35929876543', type: 'phone', name: 'A' });
  });

  it("uses the inquiry's caller phone when the contact has none", () => {
    expect(callPhoneFor({ contact: { display_name: 'A', contact_methods: [method('email', 'a@b.bg')] }, inquiry: { caller_name: 'Мария', caller_phone: '+359877000000' } }))
      .toEqual({ value: '+359877000000', type: 'phone', name: 'A' });
    expect(callPhoneFor({ contact: null, inquiry: { caller_name: 'Мария', caller_phone: '+359877000000' } }))
      .toEqual({ value: '+359877000000', type: 'phone', name: 'Мария' });
  });

  it('is null without any phone', () => {
    expect(callPhoneFor({ contact: null, inquiry: { caller_name: 'X', caller_phone: null } })).toBeNull();
    expect(callPhoneFor({})).toBeNull();
  });

  it('names the caller null when neither side has a name', () => {
    expect(callPhoneFor({ inquiry: { caller_name: null, caller_phone: '+359877000000' } }))
      .toEqual({ value: '+359877000000', type: 'phone', name: null });
  });
});
