import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import bg from "../../../../messages/bg.json";
import en from "../../../../messages/en.json";
import { PortalsPreview } from "./portals/portals-preview";
import { RulesPreview } from "./rules/rules-preview";
import { SettingsSidebar } from "./settings-sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/settings/rules" }));

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

function renderSidebar(role: string) {
  return renderToString(
    <NextIntlClientProvider locale="en" messages={en}>
      <SettingsSidebar userRole={role} />
    </NextIntlClientProvider>,
  );
}

/** The link to `href` with its label and badge, or null. */
function linkTo(html: string, href: string): string | null {
  return html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>.*?</a>`))?.[0] ?? null;
}

describe("settings sub-nav (Скоро)", () => {
  it.each(["owner", "manager"])("shows Rules and Portals with the Скоро badge to a %s", (role) => {
    const html = renderSidebar(role);
    for (const [href, label] of [
      ["/settings/rules", en.settings.rules],
      ["/settings/portals", en.settings.portals],
    ]) {
      const link = linkTo(html, href);
      expect(link, href).toContain(label);
      expect(link, href).toContain(en.ComingSoon.badge);
    }
  });

  it("marks the open placeholder as the current page", () => {
    // The active link is tinted and semibold on the anchor itself (the badge has its own classes).
    const openTag = (href: string) => linkTo(renderSidebar("owner"), href)?.match(/^<a [^>]*>/)?.[0];
    expect(openTag("/settings/rules")).toContain("font-semibold");
    expect(openTag("/settings/portals")).not.toContain("font-semibold");
  });

  it("hides both from a broker, who cannot open configuration pages", () => {
    const html = renderSidebar("broker");
    expect(linkTo(html, "/settings/rules")).toBeNull();
    expect(linkTo(html, "/settings/portals")).toBeNull();
  });
});
