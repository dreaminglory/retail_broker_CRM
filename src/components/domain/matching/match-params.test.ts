import { describe, expect, it } from 'vitest';
import { DEAL_MATCH_KEYS, PROPERTY_MATCH_KEYS, hrefWith, matchBaseParams, parseMatchView } from './match-params';

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

  it("reads the property list's own params and ignores the deal list's", () => {
    const params = { matches: 'all', matchesLinked: '1', dealMatchesPage: '2' };
    expect(parseMatchView(params, PROPERTY_MATCH_KEYS)).toEqual({ all: false, page: 2, linked: false });
    expect(parseMatchView(params)).toEqual({ all: true, page: 1, linked: true });
  });
});

describe('matchBaseParams', () => {
  it("keeps the other params, drops array values and rebuilds this list's params from the view", () => {
    const view = { all: true, page: 999, linked: true };
    const params = { tab: 'x', tags: ['a', 'b'], matches: 'all', matchesPage: '999', dealMatches: 'all' };
    expect(matchBaseParams(params, DEAL_MATCH_KEYS, view, 1)).toEqual({
      tab: 'x',
      dealMatches: 'all',
      matches: 'all',
      matchesLinked: '1',
    });
  });

  it('uses the page the service returned, and leaves page 1 out', () => {
    const view = { all: true, page: 3, linked: false };
    expect(matchBaseParams({}, DEAL_MATCH_KEYS, view, 3)).toEqual({ matches: 'all', matchesPage: '3' });
    expect(matchBaseParams({}, DEAL_MATCH_KEYS, view, 1)).toEqual({ matches: 'all' });
  });
});

describe('hrefWith', () => {
  it('keeps the other params, sets or removes the given ones and anchors on the section', () => {
    expect(hrefWith({ tab: 'x', matches: 'all' }, { matchesPage: '2' }, 'opportunity-matches')).toBe(
      '?tab=x&matches=all&matchesPage=2#opportunity-matches',
    );
    expect(hrefWith({ matches: 'all', matchesPage: '2' }, { matches: null, matchesPage: null }, 'a')).toBe('?#a');
  });
});
