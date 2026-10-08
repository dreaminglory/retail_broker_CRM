"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactListTable } from "@/components/domain/contacts/contact-list-table";
import { ContactForm } from "@/components/domain/contacts/contact-form";
import { createContactAction, searchContactsQuickAction } from "./actions";
import type { Contact } from "@/domain/contacts/types";
import { Search, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

interface ContactsPageClientProps {
  contacts: Contact[];
  initialSearch: string;
  initialStatus: string;
  agencyId: string;
  userRole?: string;
}

export function ContactsPageClient({
  contacts,
  initialSearch,
  initialStatus,
  userRole,
}: ContactsPageClientProps) {
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

  function handleStatusChange(value: string | null) {
    const v = value ?? "active";
    updateParams({ status: v === "active" ? "" : v, page: "" });
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("count", { count: contacts.length })}
            {initialStatus === "archived" ? t("archivedBadge") : ""}
            {initialSearch ? ` matching "${initialSearch}"` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(userRole === "owner" || userRole === "manager") && (
            <Button variant="outline" size="sm" onClick={() => router.push("/settings/import/new?type=contact")}>
              Import
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                New contact
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
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by name…"
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
              <div className="absolute top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none z-50 max-h-[300px] overflow-y-auto">
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
        <Select
          value={initialStatus}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("filters.active")}</SelectItem>
            <SelectItem value="archived">{t("filters.archived")}</SelectItem>
            <SelectItem value="all">{t("filters.all")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
        <ContactListTable contacts={contacts} />
      </div>
    </>
  );
}
