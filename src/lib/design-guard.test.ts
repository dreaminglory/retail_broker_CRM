import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Bright colours live once, in `src/app/globals.css` (AD-066). Components use the
 * token utilities (`bg-surface`, `text-overdue`, ...), never Tailwind palette classes
 * or colour literals, so the theme changes in one place and a status colour always
 * says which follow-up state it is.
 */

const SRC = join(process.cwd(), 'src');

/** Files allowed to hold colour literals, with the reason. */
const ALLOWED: Record<string, string> = {
  // HTML email: mail clients have no CSS variables, so the colours are inline.
  'domain/notifications/templates.ts': 'email HTML',
};

const PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';

const RULES: { name: string; pattern: RegExp }[] = [
  {
    name: 'Tailwind palette class',
    pattern: new RegExp(`(?<![\\w-])[a-z-]*-(?:${PALETTE})-\\d{2,3}\\b`, 'g'),
  },
  {
    name: 'black or white utility',
    pattern: /(?<![\w-])(?:bg|text|border|fill|stroke|ring|outline|from|to|via)-(?:black|white)\b/g,
  },
  { name: 'oklch() literal', pattern: /(?<![a-zA-Z-])oklch\(/g },
  { name: 'rgb() literal', pattern: /(?<![a-zA-Z-])rgba?\(/g },
  { name: 'hsl() literal', pattern: /(?<![a-zA-Z-])hsla?\(/g },
  // Hex in a colour position: a Tailwind arbitrary value, a CSS/style property, or
  // an attribute. A property code ("#1042": four digits, no a-f) is not a colour.
  { name: 'hex in an arbitrary value', pattern: /\[#[0-9a-fA-F]{3,8}\]/g },
  {
    name: 'hex in a style',
    pattern: /[:=]\s*['"`]?#(?:(?=\d*[a-fA-F])[0-9a-fA-F]{3,8}|\d{3}|\d{6}|\d{8})\b/g,
  },
];

export type Violation = { file: string; line: number; rule: string; match: string };

export function findViolations(path: string, source: string): Violation[] {
  const found: Violation[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    for (const rule of RULES) {
      for (const m of text.matchAll(rule.pattern)) {
        found.push({ file: path, line: index + 1, rule: rule.name, match: m[0] });
      }
    }
  });
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return [];
    return [full];
  });
}

describe('design guard (AD-066)', () => {
  it('flags palette classes, colour functions and hex colours', () => {
    const rules = (s: string) => findViolations('x.tsx', s).map((v) => v.rule);
    expect(rules('<div className="bg-red-500" />')).toEqual(['Tailwind palette class']);
    expect(rules('<div className="hover:border-l-amber-400/50" />')).toEqual(['Tailwind palette class']);
    expect(rules('<div className="bg-black/10" />')).toEqual(['black or white utility']);
    expect(rules('<div className="shadow-[0_2px_rgba(0,0,0,0.1)]" />')).toEqual(['rgb() literal']);
    expect(rules('<div className="text-[#2b63c6]" />')).toEqual(['hex in an arbitrary value']);
    expect(rules("style={{ color: '#fff' }}")).toEqual(['hex in a style']);
    expect(rules('fill="#000000"')).toEqual(['hex in a style']);
    expect(rules('--x: oklch(1 0 0);')).toEqual(['oklch() literal']);
  });

  it('allows tokens and property codes', () => {
    const ok = [
      '<div className="bg-overdue-soft text-at-risk-ink border-border-strong shadow-action" />',
      '<span className="text-muted-foreground">#1042</span>',
      '/** "#1042 Двустаен, Лозенец" */',
      ' * Active properties: "#1042" or "1042" matches the code',
      "boxShadow: 'var(--bright-shadow-float)'",
      '<div className="bg-ink/10 text-on-primary" />',
    ];
    for (const line of ok) expect(findViolations('x.tsx', line)).toEqual([]);
  });

  it('src/ holds no colour outside globals.css', () => {
    const violations = sourceFiles(SRC)
      .map((full) => relative(SRC, full).split(sep).join('/'))
      .filter((path) => !(path in ALLOWED))
      .flatMap((path) => findViolations(path, readFileSync(join(SRC, path), 'utf8')));
    expect(violations).toEqual([]);
  });

  it('shadow-action is applied only through <Button emphasis="action">', () => {
    const users = sourceFiles(SRC)
      .map((full) => relative(SRC, full).split(sep).join('/'))
      // In a quoted class string, not a comment.
      .filter((path) => /["'][^"'\n]*(?<![\w-])shadow-action\b/.test(readFileSync(join(SRC, path), 'utf8')));
    expect(users).toEqual(['components/ui/button.tsx']);
  });
});
