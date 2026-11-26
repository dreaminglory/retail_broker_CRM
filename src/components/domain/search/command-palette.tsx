"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import { globalSearchAction } from "@/app/(dashboard)/search/actions";
import type { SearchResult } from "@/domain/search/types";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Users, Briefcase, Phone, Search, Home } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** The search field (or, on the collapsed rail, its icon) that opens the dialog. */
export function SearchTrigger({
  collapsed = false,
  showShortcut = false,
  onClick,
}: {
  collapsed?: boolean;
  showShortcut?: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("search");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? t("placeholder") : undefined}
      title={collapsed ? t("placeholder") : undefined}
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface text-body text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        collapsed ? "w-9 shrink-0 justify-center" : "w-full justify-between px-3",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Search className="size-4 shrink-0" aria-hidden />
        {!collapsed && <span className="truncate">{t("placeholder")}</span>}
      </span>
      {!collapsed && showShortcut && (
        <kbd className="pointer-events-none inline-flex h-5 shrink-0 select-none items-center gap-1 rounded-sm border border-border bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      )}
    </button>
  );
}

/** Global search over contacts, deals, inquiries and properties. */
export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const t = useTranslations("search");

  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSearchQuery("");
        setResults([]);
      }, 0);
    }
  }, [open]);

  React.useEffect(() => {
    if (debouncedSearch.trim().length >= 2) {
      startTransition(async () => {
        const res = await globalSearchAction(debouncedSearch);
        if (res.success) {
          setResults(res.data);
        } else {
          setResults([]);
          toast.error(res.error);
        }
      });
    } else {
      setTimeout(() => setResults([]), 0);
    }
  }, [debouncedSearch]);

  const onSelect = (url: string) => {
    onOpenChange(false);
    router.push(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "contact":
        return <Users className="mr-2 h-4 w-4" />;
      case "opportunity":
        return <Briefcase className="mr-2 h-4 w-4" />;
      case "property":
        return <Home className="mr-2 h-4 w-4" />;
      case "inquiry":
        return <Phone className="mr-2 h-4 w-4" />;
      default:
        return <Search className="mr-2 h-4 w-4" />;
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("placeholder")} description={t("inputPlaceholder")}>
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t("inputPlaceholder")}
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {isPending && (
            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("searching")}
            </div>
          )}
          {!isPending && searchQuery.trim().length >= 2 && results.length === 0 && (
            <CommandEmpty>{t("noResults")}</CommandEmpty>
          )}
          {!isPending && results.length > 0 && (
            <CommandGroup heading={t("results")}>
              {results.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.type}-${result.title}-${result.id}`}
                  onSelect={() => onSelect(result.url)}
                >
                  {getIcon(result.type)}
                  <div className="flex flex-col">
                    <span>
                      {result.title ?? t(result.type === "inquiry" ? "unknownCaller" : "unnamedContact")}
                    </span>
                    {(result.kind || result.subtitle) && (
                      <span className="text-xs text-muted-foreground">
                        {result.kind ? t(`kinds.${result.kind}`) : result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

/**
 * The desktop sidebar's search: trigger, dialog and the Ctrl/⌘+K shortcut. Mount
 * it once; the phone menu uses SearchTrigger and SearchDialog directly, so the
 * dialog opens after the menu closes instead of on top of it.
 */
export function CommandPalette({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <SearchTrigger collapsed={collapsed} showShortcut onClick={() => setOpen(true)} />
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
