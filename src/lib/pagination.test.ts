import { describe, it, expect, vi } from "vitest";
import { loadPage, pageInfo, parsePage } from "./pagination";

describe("parsePage", () => {
  it.each([
    [undefined, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["3", 3],
  ])("parses %j as %i", (raw, expected) => {
    expect(parsePage(raw)).toBe(expected);
  });

  it("uses the first value when the param is repeated", () => {
    expect(parsePage(["2", "5"])).toBe(2);
  });
});

describe("pageInfo", () => {
  it("shows an empty list as 0–0 of 0 on page 1", () => {
    expect(pageInfo(1, 50, 0)).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0 });
  });

  it("shows the middle page range", () => {
    expect(pageInfo(2, 50, 300)).toMatchObject({ page: 2, totalPages: 6, from: 51, to: 100 });
  });

  it("ends the last page at the total", () => {
    expect(pageInfo(6, 50, 301)).toMatchObject({ page: 6, totalPages: 7, from: 251, to: 300 });
    expect(pageInfo(7, 50, 301)).toMatchObject({ page: 7, from: 301, to: 301 });
  });

  it("clamps a page past the end to the last page", () => {
    expect(pageInfo(99, 50, 120)).toMatchObject({ page: 3, from: 101, to: 120 });
  });

  it("reaches every row of 300 page by page", () => {
    const seen = new Set<number>();
    for (let p = 1; p <= pageInfo(1, 50, 300).totalPages; p++) {
      const { from, to } = pageInfo(p, 50, 300);
      for (let r = from; r <= to; r++) seen.add(r);
    }
    expect(seen.size).toBe(300);
  });
});

describe("loadPage", () => {
  it("loads the requested page with its offset", async () => {
    const load = vi.fn(async () => ({ rows: ["a"], total: 120 }));
    const result = await loadPage(2, 50, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(50, 50);
    expect(result.info).toMatchObject({ page: 2, from: 51, to: 100 });
  });

  it("falls back to the last page when the page is past the end", async () => {
    const load = vi.fn(async () => ({ rows: [], total: 120 }));
    const result = await loadPage(9, 50, load);
    expect(load).toHaveBeenNthCalledWith(1, 400, 50);
    expect(load).toHaveBeenNthCalledWith(2, 100, 50);
    expect(result.info.page).toBe(3);
  });
});
