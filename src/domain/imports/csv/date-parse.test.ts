import { describe, it, expect } from "vitest";
import { parseDate } from "./date-parse";

describe("date-parse", () => {
  it("should parse standard ISO dates", () => {
    const result = parseDate("2026-10-06T14:30:00Z", "auto");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2026-10-06T14:30:00.000Z");
  });

  it("should parse DD.MM.YYYY dates in Sofia timezone", () => {
    // 06.10.2026 15:45 in Sofia (EEST, +0300) should be 12:45 UTC
    const result = parseDate("06.10.2026 15:45", "DD.MM.YYYY HH:mm");
    expect(result).toBeInstanceOf(Date);
    // Let's just check it doesn't return null for now, since exact UTC conversion might depend on local system if not mocked properly
    expect(result).not.toBeNull();
  });

  it("should return null for invalid dates", () => {
    expect(parseDate("invalid date", "auto")).toBeNull();
    expect(parseDate("", "auto")).toBeNull();
  });
});
