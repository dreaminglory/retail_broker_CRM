import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { LanguageToggle } from "./language-toggle";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./set-locale", () => ({ setAuthLocaleAction: vi.fn() }));

function render(locale: "bg" | "en") {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={en}>
      <LanguageToggle />
    </NextIntlClientProvider>,
  );
}

describe("LanguageToggle", () => {
  it("is a named group with both languages", () => {
    const html = render("bg");
    expect(html).toContain('role="group"');
    expect(html).toContain(`aria-label="${en.auth.language}"`);
    expect(html).toContain("БГ");
    expect(html).toContain("EN");
  });

  it("presses the current language only", () => {
    expect(render("en")).toMatch(/aria-pressed="true"[^>]*>EN/);
    expect(render("bg")).toMatch(/aria-pressed="true"[^>]*>БГ/);
  });
});
