import { describe, expect, it } from "vitest";
import { buildRows, toInsertSql, transliterate } from "./build-settlements";

describe("transliterate", () => {
  it.each([
    ["София", "Sofia"],
    ["Пловдив", "Plovdiv"],
    ["Варна", "Varna"],
    ["Щъркелово", "Shtarkelovo"],
    ["Юнаците", "Yunatsite"],
    ["Жълтеш", "Zhaltesh"],
    ["Стара Загора", "Stara Zagora"],
    ["Цар Калоян", "Tsar Kaloyan"],
    ["Мизия", "Mizia"],
    ["Ябълково", "Yabalkovo"],
    ["София (столица)", "Sofia (stolitsa)"],
  ])("%s → %s", (bg, en) => {
    expect(transliterate(bg)).toBe(en);
  });

  it("keeps ия inside a word as iya", () => {
    expect(transliterate("Ияново")).toBe("Iyanovo");
  });
});

const obst = [{ obshtina: "SOF46", name: "Столична" }, { obshtina: "PDV22", name: "Пловдив" }];
const obl = [{ oblast: "SOF", name: "София (столица)" }, { oblast: "PDV", name: "Пловдив" }];
const atte = [
  { ekatte: "68134", t_v_m: "гр.", name: "София", oblast: "SOF", obshtina: "SOF46" },
  { ekatte: "56784", t_v_m: "гр.", name: "Пловдив", oblast: "PDV", obshtina: "PDV22" },
  { ekatte: "99999", t_v_m: "с.", name: "Щъркелово", oblast: "PDV", obshtina: "PDV22" },
  { ekatte: "62685", t_v_m: "ман.", name: "Рилски манастир", oblast: "PDV", obshtina: "PDV22" },
  { "Дата и час на изготвяне на справката": "01/01/2026 03:00", "Данните са актуални към": "23/12/2025" },
];

describe("buildRows", () => {
  it("keeps towns and villages, skips monasteries and the footer, sorts by code", () => {
    const rows = buildRows({ ek_atte: atte, ek_obst: obst, ek_obl: obl });
    expect(rows.map((r) => r.ekatte)).toEqual(["56784", "68134", "99999"]);
    expect(rows[1]).toEqual({
      ekatte: "68134",
      kind: "city",
      name_bg: "София",
      name_en: "Sofia",
      municipality_bg: "Столична",
      municipality_en: "Stolichna",
      province_bg: "София (столица)",
      province_en: "Sofia (stolitsa)",
    });
    expect(rows[2]).toMatchObject({ kind: "village", name_en: "Shtarkelovo" });
  });

  it("rejects a renamed column with a clear message", () => {
    const renamed = [{ code: "68134", t_v_m: "гр.", name: "София", oblast: "SOF", obshtina: "SOF46" }];
    expect(() => buildRows({ ek_atte: renamed, ek_obst: obst, ek_obl: obl })).toThrow(
      /ek_atte\.json row 1: missing column\(s\) ekatte; found code/,
    );
  });

  it("rejects a missing column in the municipalities file", () => {
    expect(() => buildRows({ ek_atte: atte, ek_obst: [{ obshtina: "SOF46" }], ek_obl: obl })).toThrow(
      /ek_obst\.json row 1: missing column\(s\) name/,
    );
  });

  it("rejects an unknown settlement type", () => {
    const odd = [{ ekatte: "11111", t_v_m: "к.", name: "Х", oblast: "SOF", obshtina: "SOF46" }];
    expect(() => buildRows({ ek_atte: odd, ek_obst: obst, ek_obl: obl })).toThrow(/unknown settlement type/);
  });

  it("rejects an empty file", () => {
    expect(() => buildRows({ ek_atte: [], ek_obst: obst, ek_obl: obl })).toThrow(/non-empty array/);
  });
});

describe("toInsertSql", () => {
  it("escapes quotes and chunks the inserts", () => {
    const row = {
      ekatte: "00001", kind: "village" as const, name_bg: "О'Х", name_en: "O'H",
      municipality_bg: "М", municipality_en: "M", province_bg: "П", province_en: "P",
    };
    const sql = toInsertSql([row, row, row], 2);
    expect(sql.match(/INSERT INTO settlements/g)).toHaveLength(2);
    expect(sql).toContain("'О''Х'");
  });
});
