"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchSettlementsAction } from "@/app/(dashboard)/settlements/actions";
import type { Settlement } from "@/domain/settlements/types";

const SEARCH_DEBOUNCE_MS = 250;

type SettlementComboboxProps = {
  id?: string;
  /** Form field that carries the chosen settlement id (empty when nothing is chosen). */
  name?: string;
  defaultValue?: Settlement | null;
  onChange?: (settlement: Settlement | null) => void;
  required?: boolean;
  invalid?: boolean;
};

/**
 * Searches the EKATTE register by name prefix as you type, in Cyrillic or Latin (20 results,
 * towns first). Same behaviour as ContactCombobox: inline list, and typed text that was never
 * picked is never submitted.
 */
export function SettlementCombobox({
  id,
  name,
  defaultValue = null,
  onChange,
  required,
  invalid,
}: SettlementComboboxProps) {
  const t = useTranslations("SettlementCombobox");
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listId = `${generatedId}-list`;

  const [selected, setSelected] = useState<Settlement | null>(defaultValue);
  const [text, setText] = useState(defaultValue?.name ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const latestRequest = useRef(0);
  const committed = useRef<Settlement | null>(defaultValue);

  // An empty query returns nothing, so only search once something is typed.
  const query = text.trim();

  useEffect(() => {
    if (!open || selected || !query) return;
    const request = ++latestRequest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchSettlementsAction(query);
        if (request !== latestRequest.current) return;
        setFailed(!result.success);
        setResults(result.success ? result.data : []);
        setActiveIndex(-1);
      } catch {
        if (request !== latestRequest.current) return;
        setFailed(true);
        setResults([]);
      } finally {
        if (request === latestRequest.current) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open, selected]);

  function choose(settlement: Settlement) {
    committed.current = settlement;
    setSelected(settlement);
    setText(settlement.name);
    setOpen(false);
    setActiveIndex(-1);
    onChange?.(settlement);
  }

  function clear() {
    committed.current = null;
    setSelected(null);
    setText("");
    setResults([]);
    setActiveIndex(-1);
    onChange?.(null);
  }

  function handleInput(value: string) {
    setText(value);
    setOpen(true);
    if (!value.trim()) setResults([]);
    if (selected) {
      setSelected(null);
      onChange?.(null);
    }
  }

  function handleBlur() {
    setOpen(false);
    if (selected) return;
    if (text.trim() === "") {
      committed.current = null;
      return;
    }
    const previous = committed.current;
    if (previous) {
      setSelected(previous);
      setText(previous.name);
      onChange?.(previous);
    } else {
      setText("");
    }
  }

  const showList = open && !selected && query !== "";

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!showList) setOpen(true);
      else setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp" && showList) {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (showList && activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        choose(results[activeIndex]);
      } else if (!selected && text.trim() !== "") {
        event.preventDefault();
      }
    } else if (event.key === "Escape" && showList) {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      setOpen(false);
    }
  }

  const status = !showList
    ? ""
    : loading
      ? t("searching")
      : failed
        ? t("error")
        : results.length === 0
          ? t("noResults")
          : t("resultsCount", { count: results.length });

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={selected?.id ?? ""} />}
      <div className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={invalid}
          required={required && !selected}
          autoComplete="off"
          className="pr-16"
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && showList && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          )}
          {(selected || text) && (
            <button
              type="button"
              aria-label={t("clear")}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <span role="status" className="sr-only">
        {status}
      </span>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground" role="presentation">
              {failed ? t("error") : loading ? t("searching") : t("noResults")}
            </li>
          ) : (
            results.map((settlement, index) => (
              <li
                key={settlement.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => choose(settlement)}
              >
                <span className="font-medium">
                  {t(`kind.${settlement.kind}`, { name: settlement.name })}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("location", { municipality: settlement.municipality, province: settlement.province })}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
