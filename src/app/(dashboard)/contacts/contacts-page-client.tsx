"use client";

import { useState, useTransition, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ListPager } from "@/components/ui/list-pager";
import type { PageInfo } from "@/lib/pagination";
import { ContactListTable } from "@/components/domain/contacts/contact-list-table";
import { ContactForm } from "@/components/domain/contacts/contact-form";
import { createContactAction, searchContactsQuickAction } from "./actions";
import type { Contact } from "@/domain/contacts/types";
import { Search, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STATUSES = ["active", "archived", "all"] as const;

interface ContactsPageClientProps {
  contacts: Contact[];
  pageInfo: PageInfo;
  initialSearch: string;
  initialStatus: string;
  agencyId: string;
  userRole?: string;
  /** The contact in `?id=`, if it was found. */
  selectedId: string | null;
  /** The server-rendered panel for the selected contact. */
  panel: ReactNode;
}

export function ContactsPageClient({
  contacts,
  pageInfo,
  initialSearch,
  initialStatus,
  userRole,
  selectedId,
  panel,
}: ContactsPageClientProps) {
  const searchParams = useSearchParams();
  const t = useTranslations("ContactsPage");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch);
  const [quickResults, setQuickResults] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setTimeout(() => setQuickResults([]), 0);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const results = await searchContactsQuickAction(search);
        setQuickResults(results);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);
  function updateParams(patch: Record<string, string>) {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    Object.entries(patch).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowSuggestions(false);
    updateParams({ search, page: "" });
  }

  /** A status tab: the list from page 1, keeping the search and the selection. */
  function statusHref(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "active") params.delete("status");
    else params.set("status", value);
    params.delete("page");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">{t("title")}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {t("count", { count: pageInfo.total })}
            {initialStatus === "archived" ? t("archivedBadge") : ""}
            {initialSearch ? t("matchingSearch", { search: initialSearch }) : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(userRole === "owner" || userRole === "manager") && (
            <Button variant="outline" size="sm" onClick={() => router.push("/settings/import/new?type=contact")}>
              {t("importBtn")}
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
              <Button emphasis="action">
                <Plus className="size-4" aria-hidden />
                {t("newContactBtn")}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("newContactTitle")}</DialogTitle>
            </DialogHeader>
            <ContactForm
              createAction={createContactAction}
              onSuccess={(id) => {
                setCreateOpen(false);
                if (id) router.push(`/contacts/${id}`);
                else router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex min-w-0 flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
            />
            {showSuggestions && search.length > 1 && quickResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-float outline-none z-50 max-h-[300px] overflow-y-auto">
                <div className="p-1">
                  {quickResults.map((contact) => (
                    <div
                      key={contact.id}
                      className="px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      onClick={() => {
                        setSearch(contact.display_name);
                        setShowSuggestions(false);
                        updateParams({ search: contact.display_name, page: "" });
                      }}
                    >
                      {contact.display_name}
                      {contact.company_name && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {contact.company_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button type="submit" variant="secondary">{t("searchBtn")}</Button>
        </form>
      </div>

      {/* Master-detail (contacts.png): list, and the selected contact beside it from 1024 px. */}
      <div className={cn("grid items-start gap-6", panel && "lg:grid-cols-[minmax(0,1fr)_26rem]")}>
        <div className={cn("min-w-0", panel && "max-lg:hidden")}>
          <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", isPending && "pointer-events-none opacity-60")}>
            <nav aria-label={t("title")} className="flex gap-5 overflow-x-auto border-b border-border px-4 pt-3 [scrollbar-width:none] sm:px-5">
              {STATUSES.map((value) => {
                const active = initialStatus === value;
                return (
                  <Link
                    key={value}
                    href={statusHref(value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-mb-px shrink-0 border-b-2 pb-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "border-primary font-semibold text-ink" : "border-transparent text-muted-foreground hover:text-ink"
                    )}
                  >
                    {t(`filters.${value}`)}
                  </Link>
                );
              })}
            </nav>
            <ContactListTable contacts={contacts} selectedId={selectedId} />
          </div>
          <ListPager page={pageInfo.page} pageSize={pageInfo.pageSize} total={pageInfo.total} />
        </div>

        {panel && <div className="min-w-0 lg:sticky lg:top-4">{panel}</div>}
      </div>
    </>
  );
}
