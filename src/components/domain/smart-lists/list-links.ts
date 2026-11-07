/** A list's count as shown: exact up to 999, "999+" above (the SQL caps it at 1000, rule 6). */
export function formatListCount(count: number): string {
  return count > 999 ? '999+' : String(count);
}

/** The list page's URL, keeping the Agency scope when it is on. */
export function listHref(listId: string, scope: 'mine' | 'agency'): string {
  return scope === 'agency' ? `/lists/${listId}?scope=agency` : `/lists/${listId}`;
}
