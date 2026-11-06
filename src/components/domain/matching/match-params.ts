/** The search params that drive a matches list: a page can show two lists, each with its own set. */
export type MatchParamKeys = { all: string; page: string; linked: string };

/** The deal's "Подходящи имоти" list. */
export const DEAL_MATCH_KEYS: MatchParamKeys = { all: "matches", page: "matchesPage", linked: "matchesLinked" };
/** The property's "Подходящи купувачи / наематели" list. */
export const PROPERTY_MATCH_KEYS: MatchParamKeys = { all: "dealMatches", page: "dealMatchesPage", linked: "dealMatchesLinked" };

export type MatchView = { all: boolean; page: number; linked: boolean };

type SearchParams = Record<string, string | string[] | undefined>;

export function parseMatchView(params: SearchParams, keys: MatchParamKeys = DEAL_MATCH_KEYS): MatchView {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const page = Number(first(params[keys.page]));
  return {
    all: first(params[keys.all]) === "all",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    linked: first(params[keys.linked]) === "1",
  };
}

/**
 * The page's search params as plain strings, with this list's own params rebuilt from its view
 * (`page` is the page the service actually returned) and every other param kept as it was.
 */
export function matchBaseParams(params: SearchParams, keys: MatchParamKeys, view: MatchView, page: number): Record<string, string> {
  const own = [keys.all, keys.page, keys.linked];
  const base = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => (typeof value === "string" && !own.includes(key) ? [[key, value]] : [])),
  );
  if (view.all) base[keys.all] = "all";
  if (view.linked) base[keys.linked] = "1";
  if (view.all && page > 1) base[keys.page] = String(page);
  return base;
}

/** A link to this page with some params set (a string) or removed (null), landing on `anchor`. */
export function hrefWith(baseParams: Record<string, string>, changes: Record<string, string | null>, anchor: string) {
  const params = new URLSearchParams(baseParams);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return `${query ? `?${query}` : "?"}#${anchor}`;
}
