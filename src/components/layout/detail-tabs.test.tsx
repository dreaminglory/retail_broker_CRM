import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DetailTabs } from "./detail-tabs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/properties/1",
  useSearchParams: () => new URLSearchParams(),
}));

const ITEMS = [
  { value: "overview" as const, label: "Overview" },
  { value: "deals" as const, label: "Deals", count: 2 },
  { value: "history" as const, label: "History" },
];

function render(initialTab: "overview" | "deals" | "history" | "nope", panels: Record<"overview" | "deals" | "history", string | null>) {
  return renderToString(
    <DetailTabs
      header={<h1>Header</h1>}
      tabLabel="Sections"
      items={ITEMS}
      defaultTab="overview"
      initialTab={initialTab as "overview"}
      panels={panels}
      aside={<p>Aside</p>}
    />,
  );
}

const PANELS = { overview: "OVERVIEW BODY", deals: "DEALS BODY", history: "HISTORY BODY" };

describe("DetailTabs", () => {
  it("shows only the open tab's panel", () => {
    const html = render("deals", PANELS);
    expect(html).toContain("DEALS BODY");
    expect(html).not.toContain("OVERVIEW BODY");
    expect(html).not.toContain("HISTORY BODY");
  });

  it("falls back to the default tab for an unknown one", () => {
    expect(render("nope", PANELS)).toContain("OVERVIEW BODY");
  });

  it("marks the open tab selected and shows counts", () => {
    const html = render("history", PANELS);
    expect(html).toMatch(/aria-selected="true"[^>]*>History/);
    expect(html).toMatch(/Deals<span[^>]*>2<\/span>/);
  });

  it("shows a busy placeholder for a tab the server did not load", () => {
    const html = render("deals", { ...PANELS, deals: null });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("DEALS BODY");
  });

  it("puts the right column between the header card and the content in the DOM", () => {
    const html = render("overview", PANELS);
    expect(html.indexOf("Header")).toBeLessThan(html.indexOf("Aside"));
    expect(html.indexOf("Aside")).toBeLessThan(html.indexOf("OVERVIEW BODY"));
  });
});
