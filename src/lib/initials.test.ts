import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("takes the first two words of a name", () => {
    expect(initials("Мария Колева")).toBe("МК");
    expect(initials("Ivan Petrov Georgiev")).toBe("IP");
  });

  it("splits an email on its separators", () => {
    expect(initials("broker@alpha.bg")).toBe("BA");
  });

  it("handles a single word and an empty string", () => {
    expect(initials("Alpha")).toBe("A");
    expect(initials("")).toBe("");
  });
});
