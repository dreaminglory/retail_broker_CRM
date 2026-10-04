"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Contact } from "@/domain/contacts/types";
import { Building2, User, Archive, ChevronRight } from "lucide-react";

interface ContactListTableProps {
  contacts: Contact[];
  onArchive?: (id: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ContactListTable({ contacts }: ContactListTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center">
        <User className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No contacts yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Create your first contact to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card divide-y">
      {contacts.map((contact) => (
        <ContactRow key={contact.id} contact={contact} />
      ))}
    </div>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const initials = getInitials(contact.display_name);
  const isPerson = contact.type === "person";

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initials}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{contact.display_name}</p>
          <Badge
            variant="secondary"
            className="shrink-0 text-[10px] px-1.5 py-0 gap-0.5"
          >
            {isPerson ? (
              <User className="h-2.5 w-2.5" />
            ) : (
              <Building2 className="h-2.5 w-2.5" />
            )}
            {isPerson ? "Person" : "Org"}
          </Badge>
          {contact.status === "archived" && (
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 opacity-60">
              <Archive className="h-2.5 w-2.5 mr-0.5" />
              Archived
            </Badge>
          )}
        </div>
        {contact.company_name && isPerson && (
          <p className="truncate text-xs text-muted-foreground">
            {contact.company_name}
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
