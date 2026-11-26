"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = {
  value: T;
  label: ReactNode;
  /** A count after the label (e.g. linked properties). */
  count?: number;
};

/**
 * Bright tabs (ui-bright): an underline in primary under the active tab. WAI-ARIA tabs pattern
 * with automatic activation: Arrow keys, Home and End move and select; only the active tab is in
 * the Tab order. The caller owns the value (the deal page keeps it in `?tab=`).
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  idBase,
  className,
}: {
  /** The tablist's accessible name. */
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Ids for `aria-controls`; pass the same base to `TabPanel`. */
  idBase: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((item) => item.value === value);
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight" ? (current === last ? 0 : current + 1)
      : event.key === "ArrowLeft" ? (current === 0 ? last : current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]", className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 pb-3 pt-1 text-body transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary font-semibold text-ink" : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="tabular-nums text-muted-foreground">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The panel for one tab; render only the active one. */
export function TabPanel({
  idBase,
  value,
  children,
  className,
}: {
  idBase: string;
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      className={cn("focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg", className)}
    >
      {children}
    </div>
  );
}

/** A stable id base for one `Tabs` + its panels. */
export function useTabsId() {
  return useId().replace(/:/g, "");
}
