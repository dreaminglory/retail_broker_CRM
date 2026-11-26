"use client";

import { useState, type ReactNode } from "react";
import { TabPanel, Tabs, useTabsId, type TabItem } from "@/components/ui/tabs";
import { useUrlParam } from "@/lib/use-url-param";

type DetailTabsProps<T extends string> = {
  /** The header card's top part: name, badges, actions. The tab bar sits under it in the same card. */
  header: ReactNode;
  tabLabel: string;
  items: TabItem<T>[];
  /** The tab shown when `?tab=` is missing or unknown; it is not written to the URL. */
  defaultTab: T;
  initialTab: T;
  /**
   * Server-rendered content by tab; only the open one is shown. A tab the server did not load
   * (null) shows a placeholder until the `?tab=` change brings its content.
   */
  panels: Record<T, ReactNode | null>;
  /** The right column: beside the tabs on desktop, between the header card and the content on a phone. */
  aside: ReactNode;
};

/**
 * Header card with tabs, the open tab's sections and the right column (property-detail.png,
 * contact-detail.png). The panels are Server Component output passed in; this only switches which
 * one shows and keeps the choice in `?tab=`.
 */
export function DetailTabs<T extends string>({ header, tabLabel, items, defaultTab, initialTab, panels, aside }: DetailTabsProps<T>) {
  const [tab, setTabState] = useState<T>(items.some((item) => item.value === initialTab) ? initialTab : defaultTab);
  const [, setTabParam] = useUrlParam("tab");
  const tabsId = useTabsId();

  function setTab(next: T) {
    setTabState(next);
    setTabParam(next === defaultTab ? null : next);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 rounded-lg border border-border bg-surface px-5 pt-5 lg:col-start-1">
        {header}
        <Tabs label={tabLabel} items={items} value={tab} onChange={setTab} idBase={tabsId} className="mt-4" />
      </div>
      <aside className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">{aside}</aside>
      <TabPanel idBase={tabsId} value={tab} className="min-w-0 space-y-6 lg:col-start-1">
        {panels[tab] ?? <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-muted" />}
      </TabPanel>
    </div>
  );
}
