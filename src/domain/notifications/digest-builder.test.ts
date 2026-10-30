import { describe, expect, it } from 'vitest';
import type { MemberRole } from '@/domain/members/types';
import { todayBucket } from '@/lib/time/agency-day';
import { buildDigest, DIGEST_MAX_ROWS } from './digest-builder';
import type { DigestInquiryInput, DigestTaskInput } from './types';

const SOFIA = 'Europe/Sofia';
const NOW = new Date('2026-01-12T06:10:00Z'); // Monday 08:10 in Sofia
const ME = 'user-me';
const OTHER = 'user-other';

function task(id: string, dueAt: string, assignedTo = ME): DigestTaskInput {
  return { id, title: `Task ${id}`, dueAt, assignedTo };
}

function inquiry(id: string, receivedAt = '2026-01-12T05:00:00Z', assignedTo: string | null = ME): DigestInquiryInput {
  return { id, callerName: `Caller ${id}`, receivedAt, assignedTo };
}

const build = (tasks: DigestTaskInput[], inquiries: DigestInquiryInput[] = [], role: MemberRole = 'broker') =>
  buildDigest({ userId: ME, role, tasks, inquiries, timezone: SOFIA, now: NOW });

describe('buildDigest', () => {
  it('is null when every section is empty', () => {
    expect(build([], [])).toBeNull();
  });

  it('is null when the only rows belong to someone else or are not due today', () => {
    const tasks = [task('a', '2026-01-10T09:00:00Z', OTHER), task('b', '2026-01-13T09:00:00Z')];
    expect(build(tasks, [inquiry('i', undefined, OTHER), inquiry('j', undefined, null)])).toBeNull();
  });

  it('sorts tasks into overdue and due today, most overdue first', () => {
    const digest = build([
      task('late', '2026-01-12T05:00:00Z'),
      task('later-today', '2026-01-12T15:00:00Z'),
      task('older', '2026-01-09T09:00:00Z'),
      task('soon', '2026-01-12T07:00:00Z'),
    ]);

    expect(digest!.overdue.rows.map((r) => r.id)).toEqual(['older', 'late']);
    expect(digest!.dueToday.rows.map((r) => r.id)).toEqual(['soon', 'later-today']);
    expect(digest!.newInquiries.rows).toEqual([]);
  });

  it('lists my new inquiries, oldest first, by caller name only', () => {
    const digest = build([], [
      inquiry('b', '2026-01-12T05:30:00Z'),
      inquiry('a', '2026-01-11T15:00:00Z'),
      inquiry('theirs', undefined, OTHER),
    ]);

    expect(digest!.newInquiries.rows).toEqual([
      { id: 'a', callerName: 'Caller a' },
      { id: 'b', callerName: 'Caller b' },
    ]);
  });

  it('keeps 10 rows as they are and shows 11 as 10 plus "+1"', () => {
    const ten = Array.from({ length: 10 }, (_, i) => task(`t${i}`, `2026-01-09T0${i}:00:00Z`));
    expect(build(ten)!.overdue).toMatchObject({ more: 0 });
    expect(build(ten)!.overdue.rows).toHaveLength(DIGEST_MAX_ROWS);

    const eleven = [...ten, task('t10', '2026-01-09T10:00:00Z')];
    const digest = build(eleven)!;
    expect(digest.overdue.rows).toHaveLength(10);
    expect(digest.overdue.more).toBe(1);
  });

  it('caps each section on its own, including inquiries', () => {
    const inquiries = Array.from({ length: 13 }, (_, i) => inquiry(`i${i}`, `2026-01-11T${String(i).padStart(2, '0')}:00:00Z`));
    const digest = build([task('x', '2026-01-12T10:00:00Z')], inquiries)!;
    expect(digest.newInquiries.rows).toHaveLength(10);
    expect(digest.newInquiries.more).toBe(3);
    expect(digest.dueToday).toEqual({ rows: [{ id: 'x', title: 'Task x', dueAt: '2026-01-12T10:00:00Z' }], more: 0 });
  });

  it('puts a task in the same section as the Today screen, around now and agency midnight', () => {
    // Sofia midnight after NOW is 2026-01-12T22:00:00Z.
    const dues = [
      '2026-01-12T06:09:59Z', // a second before now: overdue
      '2026-01-12T06:10:00Z', // exactly now: due today
      '2026-01-12T21:59:59Z', // the last second of today
      '2026-01-12T22:00:00Z', // agency midnight: tomorrow, not in the digest
      '2026-01-12T23:30:00Z', // 01:30 tomorrow in Sofia: still not today, though it is today in UTC
    ];
    const digest = build(dues.map((due, i) => task(`t${i}`, due)))!;

    const inDigest = new Map<string, string>();
    digest.overdue.rows.forEach((r) => inDigest.set(r.id, 'overdue'));
    digest.dueToday.rows.forEach((r) => inDigest.set(r.id, 'dueToday'));

    dues.forEach((due, i) => {
      const bucket = todayBucket(due, SOFIA, NOW);
      const expected = bucket === 'overdue' || bucket === 'dueToday' ? bucket : undefined;
      expect(inDigest.get(`t${i}`), due).toBe(expected);
    });
    expect([...inDigest.keys()]).toEqual(['t0', 't1', 't2']);
  });

  it('follows agency time at the DST change, not UTC', () => {
    // 2026-03-29 is the Sofia spring-forward day: midnight before it is UTC+2, after it UTC+3.
    const now = new Date('2026-03-29T05:30:00Z'); // 08:30 Sofia (UTC+3)
    const digest = buildDigest({
      userId: ME,
      role: 'broker',
      timezone: SOFIA,
      now,
      inquiries: [],
      tasks: [
        task('today-end', '2026-03-29T20:59:00Z'), // 23:59 Sofia
        task('tomorrow', '2026-03-29T21:00:00Z'), // 00:00 Sofia on the 30th
      ],
    })!;

    expect(digest.dueToday.rows.map((r) => r.id)).toEqual(['today-end']);
  });

  describe('agency counts', () => {
    const OVERDUE = '2026-01-09T09:00:00Z';
    const LATER_TODAY = '2026-01-12T15:00:00Z';

    it("gives owners and managers the whole agency's unassigned inquiries and overdue tasks", () => {
      const tasks = [task('mine', OVERDUE), task('theirs', OVERDUE, OTHER), task('not-yet', LATER_TODAY, OTHER)];
      const inquiries = [inquiry('u1', undefined, null), inquiry('u2', undefined, null), inquiry('assigned', undefined, OTHER)];

      for (const role of ['owner', 'manager'] as const) {
        expect(build(tasks, inquiries, role)!.agency, role).toEqual({ unassignedInquiries: 2, overdueTasks: 2 });
      }
    });

    it('never gives them to a broker', () => {
      const digest = build([task('mine', OVERDUE), task('theirs', OVERDUE, OTHER)], [inquiry('u', undefined, null)], 'broker');

      expect(digest!.agency).toBeNull();
    });

    it('makes a digest for an owner with no work of their own when a count is not zero', () => {
      const digest = build([task('theirs', OVERDUE, OTHER)], [], 'owner');

      expect(digest!.overdue.rows).toEqual([]);
      expect(digest!.agency).toEqual({ unassignedInquiries: 0, overdueTasks: 1 });
    });

    it('makes no digest for an owner when own work and counts are all empty', () => {
      expect(build([task('not-yet', LATER_TODAY, OTHER)], [inquiry('assigned', undefined, OTHER)], 'owner')).toBeNull();
    });

    it('leaves the counts out when both are zero but own work exists', () => {
      expect(build([task('mine', LATER_TODAY)], [], 'owner')!.agency).toBeNull();
    });

    it('makes no digest for a broker when only agency rows exist', () => {
      expect(build([task('theirs', OVERDUE, OTHER)], [inquiry('u', undefined, null)], 'broker')).toBeNull();
    });
  });

  it('carries no phone, email, note or subject field', () => {
    const digest = build([task('a', '2026-01-09T09:00:00Z')], [inquiry('i')])!;

    expect(Object.keys(digest.overdue.rows[0]).sort()).toEqual(['dueAt', 'id', 'title']);
    expect(Object.keys(digest.newInquiries.rows[0]).sort()).toEqual(['callerName', 'id']);
  });
});
