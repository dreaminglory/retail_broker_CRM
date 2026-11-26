import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));

import { setAuthLocaleAction } from "./set-locale";

describe("setAuthLocaleAction", () => {
  beforeEach(() => set.mockClear());

  it("stores bg and en in NEXT_LOCALE", async () => {
    await setAuthLocaleAction("en");
    expect(set).toHaveBeenCalledWith("NEXT_LOCALE", "en", expect.objectContaining({ path: "/" }));
  });

  it("ignores any other value", async () => {
    await setAuthLocaleAction("de");
    expect(set).not.toHaveBeenCalled();
  });
});
