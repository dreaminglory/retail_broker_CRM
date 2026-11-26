"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { Contact } from "@/domain/contacts/types";
import { Building2, User, Archive, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWithParam } from "@/lib/url-state";
import { useRelativeTime } from "@/lib/i18n/use-relative-time";

interface ContactListTableProps {
  contacts: Contact[];
  /** The contact in `?id=`, shown in the panel. */
  selectedId?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Below this width there is no panel: a row opens the contact page (spec ui-bright). */
const PANEL_QUERY = "(min-width: 1024px)";

/**
 * The contacts list (contacts.png): initials, name, type, company and last activity. From
 * 1024 px a row selects the contact into `?id=` for the panel (replace, not push); below it, the
 * row opens `/contacts/[id]`.
 */
export function ContactListTable({ contacts, selectedId = null }: ContactListTableProps) {
  const t = useTranslations("ContactListTable");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const ago = useRelativeTime();

  if (contacts.length === 0) {
    return (
      <div className="py-16 text-center">
        <User className="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p className="text-body-strong text-muted-foreground">{t("emptyTitle")}</p>
        <p className="mt-1 text-small text-muted-foreground">{t("emptyDescription")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {contacts.map((contact) => {
        const selected = contact.id === selectedId;
        const isPerson = contact.type === "person";
        return (
          <li key={contact.id}>
            <Link
              href={hrefWithParam(pathname, search, "id", contact.id)}
              replace
              scroll={false}
              aria-current={selected ? "true" : undefined}
              data-testid="contact-row"
              onClick={(event) => {
                // A phone has no room for the panel: go to the contact page instead.
                if (event.metaKey || event.ctrlKey || event.shiftKey || window.matchMedia(PANEL_QUERY).matches) return;
                event.preventDefault();
                router.push(`/contacts/${contact.id}`);
              }}
              className={cn(
                "flex items-center gap-3 border-l-2 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5",
                selected ? "border-l-primary bg-accent" : "border-l-transparent hover:bg-muted"
              )}
            >
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sea-light text-small font-semibold text-primary">
                {getInitials(contact.display_name)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-body-strong text-ink">{contact.display_name}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {isPerson ? <User aria-hidden /> : <Building2 aria-hidden />}
                    {isPerson ? t("typePerson") : t("typeOrg")}
                  </Badge>
                  {contact.status === "archived" && (
                    <Badge variant="outline" className="shrink-0">
                      <Archive aria-hidden />
                      {t("archived")}
                    </Badge>
                  )}
                </span>
                {contact.company_name && isPerson && (
                  <span className="block truncate text-small text-muted-foreground">{contact.company_name}</span>
                )}
              </span>

              <span className="hidden shrink-0 text-small tabular-nums text-muted-foreground sm:block">{ago(contact.updated_at)}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
