"use client";

import { useState, type ReactNode } from "react";
import { TabPanel, Tabs, useTabsId, type TabItem } from "@/components/ui/tabs";
import { useUrlParam } from "@/lib/use-url-param";
import type { PropertyTab } from "./property-tabs";

type PropertyDetailTabsProps = {
  /** The header card's top part: code, title, actions. The tab bar sits under it in the same card. */
  header: ReactNode;
  tabLabel: string;
  items: TabItem<PropertyTab>[];
  initialTab: PropertyTab;
  /** Server-rendered content by tab; only the open one is shown. */
  panels: Record<PropertyTab, ReactNode>;
  /** The right column (parties); beside the tabs on desktop, below them on a phone. */
  aside: ReactNode;
};

/**
 * Header card with tabs, the open tab's sections and the right column (property-detail.png).
 * The panels are Server Component output passed in; this only switches which one shows and keeps
 * the choice in `?tab=`.
 */
export function PropertyDetailTabs({ header, tabLabel, items, initialTab, panels, aside }: PropertyDetailTabsProps) {
  const [tab, setTabState] = useState<PropertyTab>(items.some((item) => item.value === initialTab) ? initialTab : "overview");
  const [, setTabParam] = useUrlParam("tab");
  const tabsId = useTabsId();

  function setTab(next: PropertyTab) {
    setTabState(next);
    setTabParam(next === "overview" ? null : next);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border border-border bg-surface px-5 pt-5">
          {header}
          <Tabs label={tabLabel} items={items} value={tab} onChange={setTab} idBase={tabsId} className="mt-4" />
        </div>
        <TabPanel idBase={tabsId} value={tab} className="space-y-6">
          {panels[tab]}
        </TabPanel>
      </div>
      <aside className="min-w-0 space-y-6">{aside}</aside>
    </div>
  );
}
