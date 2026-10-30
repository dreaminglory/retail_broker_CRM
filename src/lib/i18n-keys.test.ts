import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import bg from '../../messages/bg.json';
import en from '../../messages/en.json';

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [prefix + key] : flatten(value, `${prefix}${key}.`)
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// The keys that reach the UI through toActionError(): a missing one shows up as raw text.
const KEY_PATTERNS = [
  /new DomainError\(\s*['"]([\w.]+)['"]/g,
  /['"]((?:validation|import\.errors)\.\w+)['"]/g,
];

function errorKeysInSource(): string[] {
  const keys = new Set<string>();
  for (const file of sourceFiles('src')) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of KEY_PATTERNS) {
      for (const match of source.matchAll(pattern)) keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

describe('messages', () => {
  const enKeys = flatten(en);
  const bgKeys = flatten(bg);

  it('bg and en have the same keys', () => {
    expect(bgKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !bgKeys.includes(key))).toEqual([]);
  });

  it('every error key used in the code exists', () => {
    const keys = errorKeysInSource();
    expect(keys.length).toBeGreaterThan(40);
    expect(keys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });
});
