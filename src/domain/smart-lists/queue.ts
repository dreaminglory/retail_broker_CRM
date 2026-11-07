/**
 * Work through (spec rule 7, AD-062): the queue's state lives in the URL, nothing is stored.
 *
 * The deal page carries the list, the position, the total and the deal's sort key **as it was
 * when the queue opened the deal**. Working the deal moves its key (a completed task is a new
 * touch, a new task a new next action), so Next asks for the row after the key it came with, not
 * the deal's key now; otherwise a step would skip every deal in between.
 */

import type { ListScope, SortKey } from './types';

type Params = Record<string, string | string[] | undefined>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function scopeParam(scope: ListScope | string | undefined): string {
  return scope === 'agency' ? '&scope=agency' : '';
}

function wholeNumber(value: string | undefined, min: number): number | null {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min ? n : null;
}

function sortKey(key: string | undefined, id: string | undefined): SortKey | null {
  if (key === undefined || key === '' || !id || !UUID_RE.test(id)) return null;
  const k = Number(key);
  return Number.isFinite(k) ? [k, id] : null;
}

export type QueueStepInput = { dir: 'next' | 'prev'; pos: number; after: SortKey | null; scope: string | undefined };

/** A step: the next row after `after` (or the first), or the row before position `pos`. */
export function queueStepHref(input: {
  listId: string;
  dir: 'next' | 'prev';
  pos: number;
  after?: SortKey | null;
  scope: ListScope;
}): string {
  const key = input.after ? `&key=${input.after[0]}&after=${input.after[1]}` : '';
  return `/lists/${encodeURIComponent(input.listId)}/step?dir=${input.dir}&pos=${input.pos}${key}${scopeParam(input.scope)}`;
}

export function parseQueueStep(params: Params): QueueStepInput {
  return {
    dir: first(params.dir) === 'prev' ? 'prev' : 'next',
    pos: wholeNumber(first(params.pos), 0) ?? 0,
    after: sortKey(first(params.key), first(params.after)),
    scope: first(params.scope),
  };
}

export type QueueView = { listId: string; pos: number; total: number; sortKey: SortKey | null; scope: string | undefined };

/** The deal page inside a queue. */
export function queueDealHref(input: {
  listId: string;
  dealId: string;
  sortKey: SortKey;
  pos: number;
  total: number;
  scope: ListScope;
}): string {
  return `/opportunities/${input.dealId}?list=${encodeURIComponent(input.listId)}&pos=${input.pos}&of=${input.total}&key=${input.sortKey[0]}${scopeParam(input.scope)}`;
}

/** The queue state on a deal page, or null when it wasn't opened from a list. */
export function parseQueueView(params: Params, dealId: string): QueueView | null {
  const listId = first(params.list);
  if (!listId) return null;
  return {
    listId,
    pos: wholeNumber(first(params.pos), 1) ?? 1,
    total: wholeNumber(first(params.of), 0) ?? 0,
    sortKey: sortKey(first(params.key), dealId),
    scope: first(params.scope),
  };
}
