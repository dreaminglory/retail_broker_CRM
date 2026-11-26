import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import bg from "../../../../messages/bg.json";
import en from "../../../../messages/en.json";
import { PortalsPreview } from "./portals/portals-preview";
import { RulesPreview } from "./rules/rules-preview";

const PREVIEWS = {
  rules: RulesPreview,
  portals: PortalsPreview,
} as const;

function render(name: keyof typeof PREVIEWS, locale: "bg" | "en") {
  const Preview = PREVIEWS[name];
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === "bg" ? bg : en}>
      <Preview />
    </NextIntlClientProvider>,
  );
}

describe.each(Object.keys(PREVIEWS) as (keyof typeof PREVIEWS)[])("%s placeholder (Скоро)", (name) => {
  it.each([
    ["bg", "Още не работи — показва примерни данни"],
    ["en", en.ComingSoon.banner],
  ] as const)("shows the banner in %s", (locale, banner) => {
    expect(render(name, locale)).toContain(banner);
  });

  it("disables every control", () => {
    const html = render(name, "en");
    const controls = html.match(/<(button|input|select|textarea)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThan(3);
    for (const control of controls) expect(control).toMatch(/\sdisabled(=|\s|\/|>)/);
  });

  it("imports nothing from Supabase or the domain layer", () => {
    const source = readFileSync(join(__dirname, name, `${name}-preview.tsx`), "utf8");
    expect(source).not.toMatch(/@\/lib\/supabase|@\/domain|actions"/);
  });
});

describe("settings sub-nav (Скоро)", () => {
  it("lists Rules and Portals with the Скоро badge", () => {
    const source = readFileSync(join(__dirname, "settings-sidebar.tsx"), "utf8");
    expect(source).toContain("/settings/rules");
    expect(source).toContain("/settings/portals");
    expect(source).toContain("ComingSoonBadge");
  });
});
