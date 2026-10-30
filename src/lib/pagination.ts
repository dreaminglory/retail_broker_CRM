/** Server-side paging maths shared by the list pages (spec: trustworthy-loop, rule 7). */

export const PAGE_SIZE = 50;

/** `?page=` as a positive integer; anything else is page 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** 1-based position of the first and last row on the page; 0 when the list is empty. */
  from: number;
  to: number;
};

/** Clamps `page` to the last page and returns the row range it shows. */
export function pageInfo(page: number, pageSize: number, total: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  return { page: current, pageSize, total, totalPages, from, to };
}

export type PagedRows<T> = { rows: T[]; total: number };

/**
 * Loads one page. A page past the end (a stale link, or rows deleted meanwhile) loads the last
 * page instead of showing an empty list.
 */
export async function loadPage<T>(
  page: number,
  pageSize: number,
  load: (offset: number, limit: number) => Promise<PagedRows<T>>
): Promise<PagedRows<T> & { info: PageInfo }> {
  let result = await load((page - 1) * pageSize, pageSize);
  let info = pageInfo(page, pageSize, result.total);
  if (info.page !== page) {
    result = await load((info.page - 1) * pageSize, pageSize);
    info = pageInfo(info.page, pageSize, result.total);
  }
  return { ...result, info };
}
