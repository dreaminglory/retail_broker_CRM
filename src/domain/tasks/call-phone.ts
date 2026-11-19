/**
 * The phone a Today call task offers to call (spec phone-loop rule 1): the task's contact's
 * primary phone, else the deal's primary contact's (most deal tasks carry no contact of their
 * own), else the inquiry's caller phone. Within a contact: the primary phone, any phone, then a
 * saved Viber or WhatsApp method. Pure, so the repository's embed shape is tested without a
 * database.
 */

import type { ContactMethodType } from '@/domain/contacts/types';

/** What a task card needs to show Call and Viber: the value, its method type and who it reaches. */
export type TaskCallPhone = { value: string; type: ContactMethodType; name: string | null };

type MethodRow = { type: string; value: string; is_primary: boolean | null };
type ContactRow = { display_name: string | null; contact_methods?: MethodRow[] | null } | null;

export type CallPhoneRow = {
  contact?: ContactRow;
  /** The deal's primary contact. */
  dealContact?: ContactRow;
  inquiry?: { caller_name: string | null; caller_phone: string | null } | null;
};

const PHONE_TYPES = ['phone', 'viber', 'whatsapp'] as const;

/** A contact's phone to call: the primary phone, any phone, then a saved Viber or WhatsApp. */
export function contactPhone(contact: ContactRow | undefined): TaskCallPhone | null {
  const methods = contact?.contact_methods ?? [];
  for (const type of PHONE_TYPES) {
    const ofType = methods.filter((m) => m.type === type && m.value.trim() !== '');
    const found = ofType.find((m) => m.is_primary) ?? ofType[0];
    if (found) return { value: found.value, type, name: contact?.display_name ?? null };
  }
  return null;
}

export function callPhoneFor(row: CallPhoneRow): TaskCallPhone | null {
  const own = contactPhone(row.contact) ?? contactPhone(row.dealContact);
  if (own) return own;

  const callerPhone = row.inquiry?.caller_phone?.trim();
  if (!callerPhone) return null;
  const name = row.contact?.display_name ?? row.dealContact?.display_name ?? row.inquiry?.caller_name ?? null;
  return { value: callerPhone, type: 'phone', name };
}

/** A contact's primary email, else its first one. */
export function contactEmail(contact: ContactRow | undefined): string | null {
  const emails = (contact?.contact_methods ?? []).filter((m) => m.type === 'email' && m.value.trim() !== '');
  return (emails.find((m) => m.is_primary) ?? emails[0])?.value ?? null;
}
