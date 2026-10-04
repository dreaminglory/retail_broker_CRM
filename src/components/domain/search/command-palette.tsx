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
import { Users, Briefcase, Phone, Search } from "lucide-react";
import { Loader2 } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();

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
        setResults(res);
      });
    } else {
      setTimeout(() => setResults([]), 0);
    }
  }, [debouncedSearch]);

  const onSelect = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "contact":
        return <Users className="mr-2 h-4 w-4" />;
      case "opportunity":
        return <Briefcase className="mr-2 h-4 w-4" />;
      case "inquiry":
        return <Phone className="mr-2 h-4 w-4" />;
      default:
        return <Search className="mr-2 h-4 w-4" />;
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full sm:w-64"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search...</span>
        </span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
        placeholder="Search contacts, opportunities, and inquiries..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        {isPending && (
          <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}
        {!isPending && searchQuery.trim().length >= 2 && results.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {!isPending && results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={`${result.type}-${result.id}`}
                value={`${result.type}-${result.title}-${result.id}`}
                onSelect={() => onSelect(result.url)}
              >
                {getIcon(result.type)}
                <div className="flex flex-col">
                  <span>{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
        </Command>
    </CommandDialog>
    </>
  );
}
