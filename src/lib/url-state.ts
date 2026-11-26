/**
 * View state in the URL (spec ui-bright, plan decision 4): the deal page's `?tab=` and the
 * master-detail `?id=`. A refresh or a shared link keeps the view; switching it replaces the
 * history entry instead of pushing one, so Back leaves the page rather than stepping through tabs.
 *
 * Pure helpers, safe in Server Components; the hook is `useUrlParam` in `use-url-param.ts`.
 */

/** A value from `choices`, or `fallback` when the param is missing or unknown. */
export function parseChoice<T extends string>(
  value: string | string[] | null | undefined,
  choices: readonly T[],
  fallback: T,
): T {
  const first = Array.isArray(value) ? value[0] : value;
  return choices.includes(first as T) ? (first as T) : fallback;
}

/** `pathname` with `key` set to `value` (or removed on null) and every other param kept. */
export function hrefWithParam(pathname: string, search: string, key: string, value: string | null): string {
  const params = new URLSearchParams(search);
  if (value === null) params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
