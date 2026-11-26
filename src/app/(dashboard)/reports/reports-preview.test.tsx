import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import bg from "../../../../messages/bg.json";
import en from "../../../../messages/en.json";
import { ReportsPreview } from "./reports-preview";

function render(locale: "bg" | "en") {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === "bg" ? bg : en}>
      <ReportsPreview />
    </NextIntlClientProvider>,
  );
}

describe("ReportsPreview (Скоро placeholder)", () => {
  it.each([
    ["bg", "Още не работи — показва примерни данни"],
    ["en", en.ComingSoon.banner],
  ] as const)("shows the banner in %s", (locale, banner) => {
    expect(render(locale)).toContain(banner);
  });

  it("disables every button", () => {
    const buttons = render("en").match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(5);
    for (const button of buttons) expect(button).toMatch(/\sdisabled(=|\s|>)/);
  });

  it("lists the podium 1st, 2nd, 3rd so a screen reader reads the ranking in order", () => {
    const html = render("en");
    const podium = html.slice(html.indexOf('aria-labelledby="reports-podium"'), html.indexOf('aria-labelledby="reports-goal"'));
    const { b1, b2, b3 } = en.Reports.brokers;
    expect(podium.indexOf(b1)).toBeGreaterThan(-1);
    expect(podium.indexOf(b1)).toBeLessThan(podium.indexOf(b2));
    expect(podium.indexOf(b2)).toBeLessThan(podium.indexOf(b3));
  });

  it("shows sample brokers from message keys", () => {
    expect(render("bg")).toContain(bg.Reports.brokers.b1);
    expect(render("en")).toContain(en.Reports.brokers.b1);
  });

  it("imports nothing from Supabase or the domain layer", () => {
    for (const file of ["page.tsx", "reports-preview.tsx"]) {
      const source = readFileSync(join(__dirname, file), "utf8");
      expect(source, file).not.toMatch(/@\/lib\/supabase|@\/domain|actions"/);
    }
  });
});
