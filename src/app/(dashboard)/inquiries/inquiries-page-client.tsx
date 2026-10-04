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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InquiryCard } from "@/components/domain/inquiries/inquiry-card";
import { InquiryForm } from "@/components/domain/inquiries/inquiry-form";
import { ConvertInquiryDialog } from "@/components/domain/inquiries/convert-inquiry-dialog";
import {
  createInquiryAction,
  markInquiryContactedAction,
  dismissInquiryAction,
  convertInquiryAction,
  searchInquiriesQuickAction,
} from "./actions";
import type { Inquiry } from "@/domain/inquiries/types";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Stage } from "@/domain/stages/types";
import type { Contact } from "@/domain/contacts/types";
import type { ActiveBroker } from "@/domain/members/types";
import { Search, Plus, Inbox } from "lucide-react";
import { useFormStatus } from "react-dom";

// ── Dismiss submit button ─────────────────────────────────────────────────────

function DismissSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      id="dismiss-inquiry-submit"
    >
      {pending ? "Dismissing…" : "Dismiss inquiry"}
    </Button>
  );
}

// ── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All inquiries" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "dismissed", label: "Dismissed" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface InquiriesPageClientProps {
  inquiries: Inquiry[];
  leadSources: LeadSource[];
  stages: Stage[];
  contacts: Contact[];
  brokers: ActiveBroker[];
  initialSearch: string;
  initialStatus: string;
  initialId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InquiriesPageClient({
  inquiries,
  leadSources,
  stages,
  contacts,
  brokers,
  initialSearch,
  initialStatus,
  initialId,
}: InquiriesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch);

  const [dismissTarget, setDismissTarget] = useState<Inquiry | null>(null);
  const [convertTarget, setConvertTarget] = useState<Inquiry | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

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

  async function handleMarkContacted(id: string) {
    await markInquiryContactedAction(id);
    router.refresh();
  }

  function handleOpenDismiss(inquiry: Inquiry) {
    setDismissTarget(inquiry);
  }

  function handleOpenConvert(inquiry: Inquiry) {
    setConvertTarget(inquiry);
    setConvertOpen(true);
  }

  const statusLabel =
    STATUS_FILTER_OPTIONS.find((o) => o.value === initialStatus)?.label ??
    "All inquiries";

  const displayedInquiries = initialId 
    ? inquiries.filter(i => i.id === initialId) 
    : inquiries;

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inquiries</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {inquiries.length} {statusLabel.toLowerCase()}
            {initialSearch ? ` matching "${initialSearch}"` : ""}
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button size="sm" id="new-inquiry-btn">
                <Plus className="mr-1.5 h-4 w-4" />
                Log inquiry
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Log new inquiry</DialogTitle>
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

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by caller name, phone, subject…"
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
                        {inquiry.caller_name || "Unknown Caller"} {inquiry.caller_phone ? `(${inquiry.caller_phone})` : ""}
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
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        <Select value={initialStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-44" id="inquiry-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {initialId && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-muted/50 px-4 py-2 text-sm text-muted-foreground border">
          <p>Showing a single inquiry from your dashboard.</p>
          <Button variant="link" className="h-auto p-0" onClick={() => router.push("/inquiries")}>
            View all inquiries
          </Button>
        </div>
      )}
      <div
        className={`space-y-2 ${isPending ? "opacity-60 pointer-events-none" : ""}`}
      >
        {displayedInquiries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {initialId ? "Inquiry not found" : "No inquiries yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {initialId ? "It may have been deleted or you don't have access." : "Log your first inquiry using the button above."}
            </p>
          </div>
        ) : (
          displayedInquiries.map((inquiry) => (
            <InquiryCard
              key={inquiry.id}
              inquiry={inquiry}
              leadSources={leadSources}
              onMarkContacted={handleMarkContacted}
              onConvert={handleOpenConvert}
              onDismiss={handleOpenDismiss}
            />
          ))
        )}
      </div>

      {/* ── Dismiss dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!dismissTarget}
        onOpenChange={(open: boolean) => {
          if (!open) setDismissTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dismiss inquiry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is terminal — the inquiry cannot be re-opened after dismissal.
          </p>
          {dismissTarget && (
            <form
              action={async (formData: FormData) => {
                const initialState = { success: false as const, error: "" };
                await dismissInquiryAction(dismissTarget.id, initialState, formData);
                setDismissTarget(null);
                router.refresh();
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="dismiss-reason">Reason (optional)</Label>
                <Textarea
                  id="dismiss-reason"
                  name="dismissed_reason"
                  placeholder="e.g. Wrong number, spam, client found elsewhere…"
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDismissTarget(null)}
                >
                  Cancel
                </Button>
                <DismissSubmitButton />
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Convert dialog ───────────────────────────────────────────────────── */}
      {convertTarget && (
        <ConvertInquiryDialog
          open={convertOpen}
          onOpenChange={(open: boolean) => {
            setConvertOpen(open);
            if (!open) setConvertTarget(null);
          }}
          inquiry={convertTarget}
          stages={stages}
          contacts={contacts}
          brokers={brokers}
          convertAction={convertInquiryAction}
          onSuccess={(opportunityId) => {
            router.push(`/opportunities/${opportunityId}`);
          }}
        />
      )}
    </>
  );
}
