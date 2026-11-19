"use client";

import { contactEmail, contactPhone } from "@/domain/tasks/call-phone";
import type { ContactMethod } from "@/domain/contacts/types";
import { cn } from "@/lib/utils";
import type { CallTargetBase } from "./call-targets";
import { ContactLinks } from "./contact-links";

type ContactQuickLinksProps = {
  contact: { display_name: string; contact_methods?: Pick<ContactMethod, "type" | "value" | "is_primary">[] };
  callTarget: CallTargetBase;
  className?: string;
};

/** A contact's primary phone and email as links, on a deal's contact rows (spec phone-loop rule 1). */
export function ContactQuickLinks({ contact, callTarget, className }: ContactQuickLinksProps) {
  const phone = contactPhone(contact);
  const email = contactEmail(contact);
  if (!phone && !email) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {phone && <ContactLinks value={phone.value} type={phone.type} name={contact.display_name} callTarget={callTarget} />}
      {email && <ContactLinks value={email} type="email" name={contact.display_name} />}
    </span>
  );
}
