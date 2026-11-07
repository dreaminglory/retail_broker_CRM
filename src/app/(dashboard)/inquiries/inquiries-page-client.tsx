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
import { InquiryForm } from "@/components/domain/inquiries/inquiry-form";
import { InquiryList } from "@/components/domain/inquiries/inquiry-list";
import { createInquiryAction, searchInquiriesQuickAction } from "./actions";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Stage } from "@/domain/stages/types";
import type { ActiveBroker } from "@/domain/members/types";
import { Search, Plus, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PageInfo } from "@/lib/pagination";

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
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InquiriesPageClient({
  inquiries,
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
}: InquiriesPageClientProps) {
  const t = useTranslations("InquiriesPage");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

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

  function handleStatusChange(value: string | null) {
    const v = value ?? "all";
    updateParams({ status: v === "all" ? "" : v, page: "" });
  }

  const statusLabel =
    t(`filters.${STATUS_FILTER_OPTIONS.find((o) => o.value === initialStatus)?.value ?? "all"}` as any);

  const displayedInquiries = initialId 
    ? inquiries.filter(i => i.id === initialId) 
    : inquiries;

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("count", { count: pageInfo.total, statusLabel: typeof statusLabel === "string" ? statusLabel.toLowerCase() : statusLabel })}
            {initialSearch ? t("matchingSearch", { search: initialSearch }) : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex gap-2">
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
              <div className="absolute top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none z-50 max-h-[300px] overflow-y-auto">
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

        <Select value={initialStatus} onValueChange={(v) => handleStatusChange(v as string | null)}>
          <SelectTrigger className="w-44" id="inquiry-status-filter">
            <SelectValue>
              {(val: string) => val ? t(`filters.${STATUS_FILTER_OPTIONS.find((o) => o.value === val)?.label ?? "all"}` as any) : t("filters.all")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {t(`filters.${o.label}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {initialId && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground border">
          <p>{t("singleInquiryLabel")}</p>
          <Button variant="link" className="h-auto p-0" onClick={() => router.push("/inquiries")}>
            {t("viewAllBtn")}
          </Button>
        </div>
      )}
      <InquiryList
        inquiries={displayedInquiries}
        pageInfo={initialId ? null : pageInfo}
        leadSources={leadSources}
        stages={stages}
        brokers={brokers}
        inactiveAssigneeNames={inactiveAssigneeNames}
        timeZone={timeZone}
        joinedDeals={joinedDeals}
        pending={isPending}
        empty={
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {initialId ? t("emptyState.notFoundTitle") : t("emptyState.emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {initialId ? t("emptyState.notFoundDesc") : t("emptyState.emptyDesc")}
            </p>
          </div>
        }
      />
    </>
  );
}
