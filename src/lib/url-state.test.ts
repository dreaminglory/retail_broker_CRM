import { describe, expect, it } from 'vitest';
import { hrefWithParam, parseChoice } from './url-state';

const TABS = ['path', 'properties', 'requirements', 'history'] as const;

describe('parseChoice (deal tabs, ui-bright T10)', () => {
  it('keeps a known value', () => {
    expect(parseChoice('history', TABS, 'path')).toBe('history');
  });

  it('falls back on an unknown, missing or repeated value', () => {
    expect(parseChoice('istoriya', TABS, 'path')).toBe('path');
    expect(parseChoice(null, TABS, 'path')).toBe('path');
    expect(parseChoice(undefined, TABS, 'path')).toBe('path');
    expect(parseChoice(['history', 'path'], TABS, 'path')).toBe('history');
  });
});

describe('hrefWithParam (?tab= and ?id=, replace not push)', () => {
  it('sets a param and keeps the others (a smart-list queue, the matches view)', () => {
    expect(hrefWithParam('/opportunities/o1', 'queue=l1&pos=2', 'tab', 'history')).toBe(
      '/opportunities/o1?queue=l1&pos=2&tab=history',
    );
  });

  it('replaces an existing value', () => {
    expect(hrefWithParam('/contacts', '?id=a&q=ivan', 'id', 'b')).toBe('/contacts?id=b&q=ivan');
  });

  it('removes the param on null, and leaves a bare path when nothing is left', () => {
    expect(hrefWithParam('/contacts', 'id=a&q=ivan', 'id', null)).toBe('/contacts?q=ivan');
    expect(hrefWithParam('/contacts', 'id=a', 'id', null)).toBe('/contacts');
  });

  it('encodes values', () => {
    expect(hrefWithParam('/contacts', '', 'q', 'a b&c')).toBe('/contacts?q=a+b%26c');
  });
});
