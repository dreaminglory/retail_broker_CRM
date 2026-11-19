/**
 * Call, Viber, WhatsApp and email links for a contact value (spec phone-loop rule 1, AD-065).
 *
 * Mobile detection needs number-type patterns, which the `min` metadata used by
 * `normalizePhone()` (AD-041) does not carry. `libphonenumber-js/mobile` is imported here only,
 * so the larger metadata stays out of every bundle that doesn't render links.
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import { normalizePhone } from '@/domain/contacts/phone';
import type { ContactMethodType } from '@/domain/contacts/types';

export type ContactLinkKind = 'call' | 'viber' | 'whatsapp' | 'email';

export type ContactLink = { kind: ContactLinkKind; href: string };

/** `e164` is a normalized number such as `+359888123456`. */
export function telHref(e164: string): string {
  return `tel:${e164}`;
}

export function viberHref(e164: string): string {
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}

export function whatsAppHref(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

/** True for a number libphonenumber types as MOBILE or FIXED_LINE_OR_MOBILE. */
export function isMobile(e164: string): boolean {
  const type = parsePhoneNumberFromString(e164)?.getType();
  return type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE';
}

/** The links a stored contact value gets, in display order. */
export function contactLinksFor(value: string, type: ContactMethodType): ContactLink[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (type === 'email') return [{ kind: 'email', href: mailtoHref(trimmed) }];
  if (type === 'other') return [];

  const e164 = normalizePhone(trimmed);
  if (!e164) {
    // A legacy number that doesn't parse (domain model gap 4): Call with its digits only.
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return [];
    return [{ kind: 'call', href: telHref(trimmed.startsWith('+') ? `+${digits}` : digits) }];
  }

  const links: ContactLink[] = [{ kind: 'call', href: telHref(e164) }];
  if (type === 'viber' || type === 'whatsapp' || isMobile(e164)) {
    links.push({ kind: 'viber', href: viberHref(e164) }, { kind: 'whatsapp', href: whatsAppHref(e164) });
  }
  return links;
}
