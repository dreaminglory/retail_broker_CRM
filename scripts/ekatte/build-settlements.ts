/**
 * Builds the settlements data migration from the NSI EKATTE JSON export
 * (spec: properties, Task 1; AD-057).
 *
 *   node --no-warnings scripts/ekatte/build-settlements.ts <dir-with-ek_atte.json> <out.sql>
 *
 * The export comes from https://www.nsi.bg/nrnm/ekatte/archive (Ekatte-YYYY-json.zip).
 * Only towns (гр.) and villages (с.) are kept; monasteries (ман.) are not places to list
 * property in. Names in English are transliterated with the Transliteration Act 2009 rules,
 * so they don't depend on the export's own `name_en`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const LETTERS: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

/** Transliteration Act 2009 (Streamlined System); "ия" at the end of a word becomes "ia". */
export function transliterate(text: string): string {
  return text.replace(/[\p{Script=Cyrillic}]+/gu, (word) => {
    const lower = word.toLowerCase();
    let out = "";
    for (let i = 0; i < lower.length; i++) {
      if (lower[i] === "и" && lower[i + 1] === "я" && i + 2 === lower.length) {
        out += "ia";
        break;
      }
      out += LETTERS[lower[i]] ?? lower[i];
    }
    if (word.length > 1 && word === word.toUpperCase()) return out.toUpperCase();
    return word[0] === lower[0] ? out : out[0].toUpperCase() + out.slice(1);
  });
}

export type SettlementRow = {
  ekatte: string;
  kind: "city" | "village";
  name_bg: string;
  name_en: string;
  municipality_bg: string;
  municipality_en: string;
  province_bg: string;
  province_en: string;
};

type Raw = Record<string, unknown>;

const COLUMNS = {
  ek_atte: ["ekatte", "t_v_m", "name", "oblast", "obshtina"],
  ek_obst: ["obshtina", "name"],
  ek_obl: ["oblast", "name"],
} as const;

const KINDS: Record<string, SettlementRow["kind"]> = { "гр.": "city", "с.": "village" };
const SKIPPED_KINDS = new Set(["ман."]);

// The export ends with a row describing the report date instead of a settlement.
function isFooter(row: Raw): boolean {
  return Object.keys(row).some((key) => key.startsWith("Данните са актуални"));
}

function checkColumns(file: keyof typeof COLUMNS, rows: Raw[]): Raw[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${file}.json: expected a non-empty array of rows`);
  }
  const data = rows.filter((row) => !isFooter(row));
  data.forEach((row, index) => {
    const missing = COLUMNS[file].filter((column) => typeof row[column] !== "string");
    if (missing.length > 0) {
      throw new Error(
        `${file}.json row ${index + 1}: missing column(s) ${missing.join(", ")}; ` +
          `found ${Object.keys(row).join(", ")}. Has the EKATTE format changed?`,
      );
    }
  });
  return data;
}

export function buildRows(input: { ek_atte: Raw[]; ek_obst: Raw[]; ek_obl: Raw[] }): SettlementRow[] {
  const settlements = checkColumns("ek_atte", input.ek_atte);
  const municipalities = new Map(
    checkColumns("ek_obst", input.ek_obst).map((row) => [row.obshtina as string, row.name as string]),
  );
  const provinces = new Map(
    checkColumns("ek_obl", input.ek_obl).map((row) => [row.oblast as string, row.name as string]),
  );

  const rows: SettlementRow[] = [];
  for (const row of settlements) {
    const prefix = row.t_v_m as string;
    if (SKIPPED_KINDS.has(prefix)) continue;
    const kind = KINDS[prefix];
    if (!kind) throw new Error(`ek_atte.json ${row.ekatte}: unknown settlement type "${prefix}"`);
    const municipality = municipalities.get(row.obshtina as string);
    const province = provinces.get(row.oblast as string);
    if (!municipality || !province) {
      throw new Error(`ek_atte.json ${row.ekatte}: unknown municipality or province code`);
    }
    const name = (row.name as string).trim();
    rows.push({
      ekatte: row.ekatte as string,
      kind,
      name_bg: name,
      name_en: transliterate(name),
      municipality_bg: municipality,
      municipality_en: transliterate(municipality),
      province_bg: province,
      province_en: transliterate(province),
    });
  }
  return rows.sort((a, b) => a.ekatte.localeCompare(b.ekatte));
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function toInsertSql(rows: SettlementRow[], chunk = 500): string {
  const parts: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const values = rows.slice(i, i + chunk).map((r) =>
      `(${[r.ekatte, r.kind, r.name_bg, r.name_en, r.municipality_bg, r.municipality_en, r.province_bg, r.province_en]
        .map(quote)
        .join(", ")})`,
    );
    parts.push(
      "INSERT INTO settlements (ekatte, kind, name_bg, name_en, municipality_bg, municipality_en, province_bg, province_en) VALUES\n" +
        values.join(",\n") +
        ";",
    );
  }
  return parts.join("\n\n");
}

const SCHEMA = `-- Settlements: global, read-only reference data from the NSI EKATTE register
-- (spec: properties, Task 1; AD-056, AD-057). Generated by scripts/ekatte/build-settlements.ts;
-- the INSERTs below are not edited by hand.

CREATE TABLE settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ekatte           TEXT NOT NULL UNIQUE CHECK (ekatte ~ '^[0-9]{5}$'),
  kind             TEXT NOT NULL CHECK (kind IN ('city', 'village')),
  name_bg          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  municipality_bg  TEXT NOT NULL,
  municipality_en  TEXT NOT NULL,
  province_bg      TEXT NOT NULL,
  province_en      TEXT NOT NULL
);

-- Prefix search for the picker: lower(name) LIKE 'плов%'.
CREATE INDEX idx_settlements_name_bg_prefix ON settlements (lower(name_bg) text_pattern_ops);
CREATE INDEX idx_settlements_name_en_prefix ON settlements (lower(name_en) text_pattern_ops);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements FORCE ROW LEVEL SECURITY;

-- Every signed-in user reads; nobody writes outside migrations.
CREATE POLICY "authenticated_select" ON settlements
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON settlements FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON settlements FROM authenticated;
`;

function main(dir: string, out: string) {
  const read = (name: string) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as Raw[];
  const rows = buildRows({ ek_atte: read("ek_atte"), ek_obst: read("ek_obst"), ek_obl: read("ek_obl") });
  writeFileSync(out, `${SCHEMA}\n${toInsertSql(rows)}\n`, "utf8");
  console.log(`${rows.length} settlements written to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) {
    console.error("Usage: node scripts/ekatte/build-settlements.ts <export-dir> <out.sql>");
    process.exit(1);
  }
  main(dir, out);
}
