import { describe, expect, it } from 'vitest';
import { hrefWith, parseMatchView } from './property-matches-section';

describe('parseMatchView', () => {
  it('defaults to the preview: not all, page 1, linked hidden', () => {
    expect(parseMatchView({})).toEqual({ all: false, page: 1, linked: false });
  });

  it('reads matches=all, the page and the linked toggle', () => {
    expect(parseMatchView({ matches: 'all', matchesPage: '3', matchesLinked: '1' })).toEqual({ all: true, page: 3, linked: true });
  });

  it('falls back to page 1 for anything that is not a positive integer', () => {
    for (const matchesPage of ['0', '-2', '1.5', 'abc', '']) {
      expect(parseMatchView({ matchesPage }).page).toBe(1);
    }
  });

  it('takes the first value of a repeated parameter and ignores other values of the flags', () => {
    expect(parseMatchView({ matches: ['all', 'x'], matchesLinked: '2' })).toEqual({ all: true, page: 1, linked: false });
  });
});

describe('hrefWith', () => {
  it('keeps the other params, sets or removes the section ones and anchors on the section', () => {
    expect(hrefWith({ tab: 'x', matches: 'all' }, { matchesPage: '2' })).toBe('?tab=x&matches=all&matchesPage=2#opportunity-matches');
    expect(hrefWith({ matches: 'all', matchesPage: '2' }, { matches: null, matchesPage: null })).toBe('?#opportunity-matches');
  });
});
