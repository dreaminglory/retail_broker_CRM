"use client";

import { useState, useTransition, useEffect } from "react";
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
import { InquiryForm } from "@/components/domain/inquiries/inquiry-form";
import Link from "next/link";
import { ListPager } from "@/components/ui/list-pager";
import { InquiryRows } from "@/components/domain/inquiries/inquiry-rows";
import { InquiryPanel } from "@/components/domain/inquiries/inquiry-panel";
import { useInquiryActions } from "@/components/domain/inquiries/inquiry-actions";
import { cn } from "@/lib/utils";
import { createInquiryAction, searchInquiriesQuickAction } from "./actions";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Stage } from "@/domain/stages/types";
import type { ActiveBroker } from "@/domain/members/types";
import { Search, Plus, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PageInfo } from "@/lib/pagination";
import { SaveListDialog, UpdateListBar } from "@/components/domain/smart-lists/save-list-dialog";

// ── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "all" },
  { value: "new", label: "new" },
  { value: "contacted", label: "contacted" },
  { value: "converted", label: "converted" },
  { value: "dismissed", label: "dismissed" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface InquiriesPageClientProps {
  inquiries: Inquiry[];
  /** The inquiry in `?id=`, for the panel; null when none is selected or it isn't found. */
  selected: Inquiry | null;
  pageInfo: PageInfo;
  leadSources: LeadSource[];
  stages: Stage[];
  brokers: ActiveBroker[];
  inactiveAssigneeNames: Record<string, string>;
  initialSearch: string;
  initialStatus: string;
  initialId?: string;
  userRole?: string;
  timeZone: string;
  /** Converted inquiries that joined a deal other than the one they started, by inquiry id. */
  joinedDeals: Record<string, { id: string; title: string }>;
  /** The saved list whose filters are being edited, if any. */
  editingList: { id: string; name: string; shownExactly: boolean } | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InquiriesPageClient({
  inquiries,
  selected,
  pageInfo,
  leadSources,
  stages,
  brokers,
  inactiveAssigneeNames,
  initialSearch,
  initialStatus,
  initialId,
  userRole,
  timeZone,
  joinedDeals,
  editingList,
}: InquiriesPageClientProps) {
  const t = useTranslations("InquiriesPage");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { handlers, dialogs } = useInquiryActions({ leadSources, stages, brokers, inactiveAssigneeNames, timeZone });

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch);

  const [quickResults, setQuickResults] = useState<Inquiry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setTimeout(() => setQuickResults([]), 0);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const results = await searchInquiriesQuickAction(search);
        setQuickResults(results);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // ── URL params ──────────────────────────────────────────────────────────────

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
    if (value === "all") params.delete("status");
    else params.set("status", value);
    params.delete("page");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const statusLabel =
    t(`filters.${STATUS_FILTER_OPTIONS.find((o) => o.value === initialStatus)?.value ?? "all"}` as any);


  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">{t("title")}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {t("count", { count: pageInfo.total, statusLabel: typeof statusLabel === "string" ? statusLabel.toLowerCase() : statusLabel })}
            {initialSearch ? t("matchingSearch", { search: initialSearch }) : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SaveListDialog entity="inquiry" />
          {(userRole === "owner" || userRole === "manager") && (
            <Button variant="outline" size="sm" onClick={() => router.push("/settings/import/new?type=inquiry")}>
              {t("importBtn")}
            </Button>
          )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button size="sm" id="new-inquiry-btn">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("logInquiryBtn")}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("logInquiryTitle")}</DialogTitle>
            </DialogHeader>
            <InquiryForm
              createAction={createInquiryAction}
              leadSources={leadSources}
              brokers={brokers}
              onSuccess={() => {
                setCreateOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {editingList && <UpdateListBar list={editingList} />}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
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
              id="inquiry-search-input"
              autoComplete="off"
            />
            {showSuggestions && search.length > 1 && quickResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-float outline-none z-50 max-h-[300px] overflow-y-auto">
                <div className="p-1">
                  {quickResults.map((inquiry) => (
                    <div
                      key={inquiry.id}
                      className="px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer flex flex-col"
                      onClick={() => {
                        const val = inquiry.caller_name || inquiry.subject || "";
                        setSearch(val);
                        setShowSuggestions(false);
                        updateParams({ search: val, page: "" });
                      }}
                    >
                      <span className="font-medium">
                        {inquiry.caller_name || t("unknownCaller")} {inquiry.caller_phone ? `(${inquiry.caller_phone})` : ""}
                      </span>
                      {inquiry.subject && (
                        <span className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                          {inquiry.subject}
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

      {/* ── Master-detail (inquiries.png) ───────────────────────────────────── */}
      {initialId && !selected && (
        <div role="status" className="mb-4 rounded-lg border border-border bg-surface px-4 py-3">
          <p className="text-body-strong text-ink">{t("emptyState.notFoundTitle")}</p>
          <p className="text-small text-muted-foreground">{t("emptyState.notFoundDesc")}</p>
        </div>
      )}
      <div className={cn("grid items-start gap-6", selected && "lg:grid-cols-[minmax(0,1fr)_24rem]")}>
        {/* Below 1024 px an open inquiry replaces the list; its panel links back. */}
        <div className={cn("min-w-0", selected && "max-lg:hidden")}>
          <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", isPending && "pointer-events-none opacity-60")}>
            {/* Status tabs: only the statuses that exist. */}
            <nav aria-label={t("title")} className="flex gap-5 overflow-x-auto border-b border-border px-4 pt-3 [scrollbar-width:none] sm:px-5">
              {STATUS_FILTER_OPTIONS.map((o) => {
                const active = initialStatus === o.value;
                return (
                  <Link
                    key={o.value}
                    href={statusHref(o.value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-mb-px shrink-0 border-b-2 pb-2.5 text-body transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active ? "border-primary font-semibold text-ink" : "border-transparent text-muted-foreground hover:text-ink"
                    )}
                  >
                    {t(`filters.${o.label}` as never)}
                  </Link>
                );
              })}
            </nav>
            {inquiries.length === 0 ? (
              <div className="py-16 text-center">
                <Inbox className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                <p className="text-body-strong text-muted-foreground">{t("emptyState.emptyTitle")}</p>
                <p className="mt-1 text-small text-muted-foreground">{t("emptyState.emptyDesc")}</p>
              </div>
            ) : (
              <InquiryRows
                inquiries={inquiries}
                selectedId={selected?.id ?? null}
                leadSources={leadSources}
                brokers={brokers}
                inactiveAssigneeNames={inactiveAssigneeNames}
              />
            )}
          </div>
          <ListPager page={pageInfo.page} pageSize={pageInfo.pageSize} total={pageInfo.total} />
        </div>

        {selected && (
          <div className="min-w-0 lg:sticky lg:top-4">
            <InquiryPanel
              key={selected.id}
              inquiry={selected}
              leadSources={leadSources}
              brokers={brokers}
              inactiveAssigneeNames={inactiveAssigneeNames}
              joinedDeal={joinedDeals[selected.id]}
              timeZone={timeZone}
              handlers={handlers}
            />
          </div>
        )}
      </div>
      {dialogs}
    </>
  );
}
