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
import { OpportunityListTable } from "@/components/domain/opportunities/opportunity-list-table";
import { OpportunityForm } from "@/components/domain/opportunities/opportunity-form";
import { createOpportunityAction, searchOpportunitiesQuickAction } from "./actions";
import type { Opportunity } from "@/domain/opportunities/types";
import type { Stage } from "@/domain/stages/types";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";
import type { LeadSource } from "@/domain/lead-sources/types";
import type { Contact } from "@/domain/contacts/types";
import type { ActiveBroker } from "@/domain/members/types";
import { Search, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

const STATUS_FILTER_KEYS = ["allStatuses", "active", "won", "lost", "nurture", "archived"];
const TYPE_FILTER_KEYS = ["allTypes", "buyer", "seller", "tenant", "landlord"];

interface OpportunitiesPageClientProps {
  opportunities: Opportunity[];
  stages: Stage[];
  leadSources: LeadSource[];
  contacts: Contact[];
  brokers: ActiveBroker[];
  initialSearch: string;
  initialStatus: string;
  initialStage: string;
  initialType: string;
}

export function OpportunitiesPageClient({
  opportunities,
  stages,
  leadSources,
  contacts,
  brokers,
  initialSearch,
  initialStatus,
  initialStage,
  initialType,
}: OpportunitiesPageClientProps) {
  const t = useTranslations("OpportunitiesPage");
  const getStageName = useStageTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState(initialSearch);

  const [quickResults, setQuickResults] = useState<Opportunity[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setTimeout(() => setQuickResults([]), 0);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const results = await searchOpportunitiesQuickAction(search);
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
      if (v && v !== "all") params.set(k, v);
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

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("count", { count: opportunities.length })}
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button size="sm" type="button">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("newBtn")}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("newTitle")}</DialogTitle>
            </DialogHeader>
            <OpportunityForm
              createAction={createOpportunityAction}
              stages={stages}
              leadSources={leadSources}
              contacts={contacts}
              brokers={brokers}
              onSuccess={(id) => {
                setCreateOpen(false);
                if (id) {
                  router.push(`/opportunities/${id}`);
                } else {
                  router.refresh();
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] flex gap-2">
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
              <div className="absolute top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none z-50 max-h-[300px] overflow-y-auto">
                <div className="p-1">
                  {quickResults.map((opportunity) => (
                    <div
                      key={opportunity.id}
                      className="px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer flex flex-col"
                      onClick={() => {
                        setSearch(opportunity.title);
                        setShowSuggestions(false);
                        updateParams({ search: opportunity.title, page: "" });
                      }}
                    >
                      <span className="font-medium">{opportunity.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button type="submit" variant="secondary">{t("searchBtn")}</Button>
        </form>

        <Select value={initialStatus} onValueChange={(v) => updateParams({ status: (v as string) || "all", page: "" })}>
          <SelectTrigger className="w-36">
            <SelectValue>
              {(val: string) => val ? t(`filters.${val === "all" ? "allStatuses" : val}` as any) : t("filters.allStatuses")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_KEYS.map((k) => (
              <SelectItem key={k} value={k === "allStatuses" ? "all" : k}>
                {t(`filters.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={initialType} onValueChange={(v) => updateParams({ type: (v as string) || "all", page: "" })}>
          <SelectTrigger className="w-36">
            <SelectValue>
              {(val: string) => val ? t(`filters.${val === "all" ? "allTypes" : val}` as any) : t("filters.allTypes")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTER_KEYS.map((k) => (
              <SelectItem key={k} value={k === "allTypes" ? "all" : k}>
                {t(`filters.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={initialStage} onValueChange={(v) => updateParams({ stage: (v as string) || "all", page: "" })}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("filters.allStages")}>
              {initialStage === "all" 
                ? t("filters.allStages")
                : getStageName(stages.find(s => s.id === initialStage)?.name ?? "") || t("filters.unknownStage")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStages")}</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {getStageName(s.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className={`${isPending ? "opacity-60 pointer-events-none" : ""}`}>
        <OpportunityListTable opportunities={opportunities} stages={stages} />
      </div>
    </>
  );
}
