import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import bg from "../../../../messages/bg.json";
import en from "../../../../messages/en.json";
import { DashboardSoon } from "./dashboard-soon";

function render(locale: "bg" | "en") {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === "bg" ? bg : en}>
      <DashboardSoon />
    </NextIntlClientProvider>,
  );
}

describe("DashboardSoon (Скоро section)", () => {
  it.each([
    ["bg", "Още не работи — показва примерни данни"],
    ["en", en.ComingSoon.banner],
  ] as const)("shows the banner in %s", (locale, banner) => {
    expect(render(locale)).toContain(banner);
  });

  it("shows the five blocks of dashboard.png", () => {
    const html = render("en");
    for (const title of [
      en.DashboardSoon.commissions.title,
      en.DashboardSoon.funnel.title,
      en.DashboardSoon.sources.title,
      en.DashboardSoon.health.title,
      en.DashboardSoon.team.title,
    ]) {
      expect(html).toContain(title);
    }
  });

  it("gives each commission bar its amount as text, not only a tooltip", () => {
    const html = render("en");
    expect(html.match(/class="sr-only">: /g)?.length).toBe(12);
  });

  it("has no working control: no button, input, link or form", () => {
    expect(render("en")).not.toMatch(/<(button|input|select|textarea|a|form)\b/);
  });

  it("imports nothing from Supabase or the domain layer", () => {
    const source = readFileSync(join(__dirname, "dashboard-soon.tsx"), "utf8");
    expect(source).not.toMatch(/@\/lib\/supabase|@\/domain|actions"/);
  });

  it("is rendered by the Табло page, below the real tiles", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    expect(page).toContain("<DashboardSoon />");
    expect(page.indexOf("<KpiTile")).toBeLessThan(page.indexOf("<DashboardSoon />"));
  });
});
