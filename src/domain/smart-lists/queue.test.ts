import { describe, expect, it } from 'vitest';
import { parseQueueStep, parseQueueView, queueDealHref, queueStepHref } from './queue';

const DEAL = '6f1c2b0e-8c1a-4a57-9f3e-1d2c3b4a5f60';

describe('queueStepHref / parseQueueStep', () => {
  it('starts a queue with no key and position 0', () => {
    expect(queueStepHref({ listId: 'no-next-action', dir: 'next', pos: 0, scope: 'mine' })).toBe(
      '/lists/no-next-action/step?dir=next&pos=0'
    );
    expect(parseQueueStep({ dir: 'next', pos: '0' })).toEqual({ dir: 'next', pos: 0, after: null, scope: undefined });
  });

  it('round-trips the current deal key and the agency scope', () => {
    const href = queueStepHref({ listId: 'overdue', dir: 'next', pos: 3, after: [-1762500000000000, DEAL], scope: 'agency' });
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseQueueStep(params)).toEqual({ dir: 'next', pos: 3, after: [-1762500000000000, DEAL], scope: 'agency' });
  });

  it('ignores a bad key, position or direction instead of failing', () => {
    expect(parseQueueStep({ dir: 'sideways', pos: '-4', key: 'abc', after: DEAL })).toEqual({
      dir: 'next',
      pos: 0,
      after: null,
      scope: undefined,
    });
    expect(parseQueueStep({ dir: 'prev', pos: '2', key: '12', after: 'not-a-uuid' }).after).toBeNull();
  });
});

describe('queueDealHref / parseQueueView', () => {
  it('puts the queue state on the deal page and reads it back', () => {
    const href = queueDealHref({ listId: 'overdue', dealId: DEAL, sortKey: [17, DEAL], pos: 2, total: 9, scope: 'agency' });
    expect(href).toBe(`/opportunities/${DEAL}?list=overdue&pos=2&of=9&key=17&scope=agency`);
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseQueueView(params, DEAL)).toEqual({ listId: 'overdue', pos: 2, total: 9, sortKey: [17, DEAL], scope: 'agency' });
  });

  it('is null without a list, and keeps a missing key as null', () => {
    expect(parseQueueView({}, DEAL)).toBeNull();
    expect(parseQueueView({ list: 'overdue', pos: 'x', of: '-1' }, DEAL)).toEqual({
      listId: 'overdue',
      pos: 1,
      total: 0,
      sortKey: null,
      scope: undefined,
    });
  });
});
