import { describe, expect, it } from 'vitest';
import { assigneeToNotify } from './service';

describe('assigneeToNotify', () => {
  it('names the new assignee when someone else made a real change', () => {
    expect(assigneeToNotify({ previous: 'a', next: 'b', actorId: 'c' })).toBe('b');
    expect(assigneeToNotify({ previous: null, next: 'b', actorId: 'c' })).toBe('b');
  });

  it('names no one when the assignee stays the same', () => {
    expect(assigneeToNotify({ previous: 'b', next: 'b', actorId: 'c' })).toBeNull();
  });

  it('names no one when you assign it to yourself', () => {
    expect(assigneeToNotify({ previous: 'a', next: 'c', actorId: 'c' })).toBeNull();
  });

  it('names no one when the inquiry is unassigned', () => {
    expect(assigneeToNotify({ previous: 'a', next: null, actorId: 'c' })).toBeNull();
  });
});
