"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchPropertiesForPicker } from "@/app/(dashboard)/properties/actions";
import type { PropertyOption } from "@/domain/properties/types";
import { propertyCode, propertyHeadline } from "./property-labels";

const SEARCH_DEBOUNCE_MS = 250;

type PropertyPickerProps = {
  id?: string;
  /** Form field that carries the chosen property id (empty when nothing is chosen). */
  name: string;
  defaultValue?: PropertyOption | null;
  onChange?: (property: PropertyOption | null) => void;
  /** Properties not to offer, e.g. the ones already linked. */
  excludeIds?: readonly string[];
  /** Shown first, before the search results (e.g. the deal's linked properties). */
  suggestions?: readonly PropertyOption[];
  required?: boolean;
  invalid?: boolean;
};

type EnumsTranslator = (key: string, values?: Record<string, string | number>) => string;

/** "#1042 Двустаен, Лозенец, София" */
export function propertyOptionLabel(enums: EnumsTranslator, property: PropertyOption): string {
  const place = [propertyHeadline(enums, property), property.area_name, property.settlement_name].filter(Boolean).join(", ");
  return `${propertyCode(property)} ${place}`;
}

/**
 * Searches the agency's active properties by #code or address as you type (rule 8: archived
 * ones never show). Works like ContactCombobox: the list renders inline so it works in dialogs
 * and on phones, and typed text that was never picked is never submitted.
 */
export function PropertyPicker({
  id,
  name,
  defaultValue = null,
  onChange,
  excludeIds = [],
  suggestions = [],
  required,
  invalid,
}: PropertyPickerProps) {
  const t = useTranslations("PropertyPicker");
  const enums = useTranslations("Enums");
  const label = (property: PropertyOption) => propertyOptionLabel(enums, property);
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listId = `${generatedId}-list`;

  const [selected, setSelected] = useState<PropertyOption | null>(defaultValue);
  const [text, setText] = useState(defaultValue ? label(defaultValue) : "");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const latestRequest = useRef(0);
  // The property to fall back to when the user types something and leaves without picking.
  const [committed, setCommitted] = useState<PropertyOption | null>(defaultValue);

  useEffect(() => {
    if (!open || selected) return;
    const request = ++latestRequest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await searchPropertiesForPicker(text);
        if (request !== latestRequest.current) return;
        setFailed(!result.success);
        setFound(result.success ? result.data : []);
        setActiveIndex(-1);
      } catch {
        if (request !== latestRequest.current) return;
        setFailed(true);
        setFound([]);
      } finally {
        if (request === latestRequest.current) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, open, selected]);

  // Suggestions first while nothing is typed; the search results never repeat one.
  const excluded = new Set(excludeIds);
  const shownSuggestions = text.trim() === "" ? suggestions.filter((property) => !excluded.has(property.id)) : [];
  const suggested = new Set(shownSuggestions.map((property) => property.id));
  const results = [...shownSuggestions, ...found.filter((property) => !excluded.has(property.id) && !suggested.has(property.id))];

  function choose(property: PropertyOption) {
    setCommitted(property);
    setSelected(property);
    setText(label(property));
    setOpen(false);
    setActiveIndex(-1);
    onChange?.(property);
  }

  function clear() {
    setCommitted(null);
    setSelected(null);
    setText("");
    setFound([]);
    setActiveIndex(-1);
    onChange?.(null);
  }

  function handleInput(value: string) {
    setText(value);
    setOpen(true);
    if (selected) {
      setSelected(null);
      onChange?.(null);
    }
  }

  function handleBlur() {
    setOpen(false);
    if (selected) return;
    if (text.trim() === "") {
      setCommitted(null);
      return;
    }
    const previous = committed;
    if (previous) {
      setSelected(previous);
      setText(label(previous));
      onChange?.(previous);
    } else {
      setText("");
    }
  }

  const showList = open && !selected;

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
      <input type="hidden" name={name} value={selected?.id ?? ""} />
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
          {loading && showList && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
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
            results.map((property, index) => (
              <li
                key={property.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => choose(property)}
              >
                <span className="block font-medium">{label(property)}</span>
                {property.address && <span className="block text-xs text-muted-foreground">{property.address}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
