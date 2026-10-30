"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchContactsForPicker } from "@/app/(dashboard)/contacts/actions";
import type { ContactOption } from "@/domain/contacts/types";

const SEARCH_DEBOUNCE_MS = 250;

type ContactComboboxProps = {
  id?: string;
  /** Form field that carries the chosen contact id (empty when nothing is chosen). */
  name: string;
  defaultValue?: ContactOption | null;
  onChange?: (contact: ContactOption | null) => void;
  required?: boolean;
  invalid?: boolean;
};

/**
 * Searches the whole agency as you type (20 results) instead of preloading a list.
 * The list renders inline, not in a portal, so it works inside dialogs and on phones.
 */
export function ContactCombobox({
  id,
  name,
  defaultValue = null,
  onChange,
  required,
  invalid,
}: ContactComboboxProps) {
  const t = useTranslations("ContactCombobox");
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-input`;
  const listId = `${generatedId}-list`;

  const [selected, setSelected] = useState<ContactOption | null>(defaultValue);
  const [text, setText] = useState(defaultValue?.display_name ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const latestRequest = useRef(0);

  // Search while the list is open and nothing is chosen. A slower, older response is dropped.
  useEffect(() => {
    if (!open || selected) return;
    const request = ++latestRequest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchContactsForPicker(text);
      if (request !== latestRequest.current) return;
      setLoading(false);
      setFailed(!result.success);
      setResults(result.success ? result.data : []);
      setActiveIndex(-1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, open, selected]);

  function choose(contact: ContactOption) {
    setSelected(contact);
    setText(contact.display_name);
    setOpen(false);
    onChange?.(contact);
  }

  function clear() {
    setSelected(null);
    setText("");
    setResults([]);
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault(); // pick the contact, don't submit the form
      choose(results[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation(); // close the list, not the dialog around it
      setOpen(false);
    }
  }

  const showList = open && !selected;

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <div className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-invalid={invalid}
          // Required means a contact must be chosen, not just text typed.
          required={required && !selected}
          autoComplete="off"
          className="pr-16"
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
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

      {showList && (
        <ul
          id={listId}
          role="listbox"
          // mousedown would blur the input and close the list before the click lands
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground" role="presentation">
              {failed ? t("error") : loading ? t("searching") : t("noResults")}
            </li>
          ) : (
            results.map((contact, index) => (
              <li
                key={contact.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => choose(contact)}
              >
                <span className="font-medium">{contact.display_name}</span>
                {contact.type === "person" && contact.company_name && (
                  <span className="ml-2 text-xs text-muted-foreground">{contact.company_name}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
