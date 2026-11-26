import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import bg from "../../../messages/bg.json";
import en from "../../../messages/en.json";
import { ComingSoonBadge, ComingSoonBanner, ComingSoonControl } from "./coming-soon";

function render(node: React.ReactNode, locale: "bg" | "en" = "en") {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === "bg" ? bg : en}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("ComingSoon", () => {
  it("the banner says the screen is not live and shows sample data, in both languages", () => {
    expect(render(<ComingSoonBanner />, "en")).toContain(en.ComingSoon.banner);
    expect(render(<ComingSoonBanner />, "bg")).toContain("Още не работи — показва примерни данни");
  });

  it("the banner is a static note, not a live region", () => {
    expect(render(<ComingSoonBanner />)).toContain('role="note"');
  });

  it("the badge reads Скоро in Bulgarian", () => {
    expect(render(<ComingSoonBadge />, "bg")).toContain("Скоро");
    expect(render(<ComingSoonBadge />, "en")).toContain(en.ComingSoon.badge);
  });

  it("a control is a disabled button that does nothing", () => {
    const html = render(<ComingSoonControl>{en.Reports.export}</ComingSoonControl>);
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain(en.Reports.export);
  });
});
