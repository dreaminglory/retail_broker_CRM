import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createFakeSupabase, type FakeSupabase } from '@/test/fake-supabase';
import { DomainError } from '@/lib/errors';
import { TaskService } from './service';
import type { RescheduleTaskInput, Task, TaskStatus } from './types';
import { ZodError } from 'zod';

const SOFIA = 'Europe/Sofia';
const TASK_ID = '11111111-1111-4111-8111-111111111111';

function task(status: TaskStatus): Task {
  return {
    id: TASK_ID,
    agency_id: 'agency-1',
    opportunity_id: null,
    contact_id: null,
    title: 'Call back',
    description: null,
    task_type: 'call',
    due_at: '2026-01-15T08:00:00.000Z',
    status,
    outcome: null,
    completed_at: null,
    assigned_to: 'user-1',
    created_by: 'user-1',
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-01-10T08:00:00.000Z',
  };
}

let fake: FakeSupabase;

function serviceWith(status: TaskStatus) {
  fake = createFakeSupabase({ role: 'broker', tables: { tasks: task(status) } });
  return new TaskService(fake.client as SupabaseClient, { timezone: SOFIA });
}

const taskUpdates = () => fake.writes.filter((w) => w.table === 'tasks' && w.op === 'update');

describe('TaskService.reschedule presets (agency time)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Thursday 15 January 2026, 14:00 in Sofia
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['plus_1h', '2026-01-15T13:00:00.000Z'],
    ['tomorrow_9', '2026-01-16T07:00:00.000Z'],
    ['plus_2d', '2026-01-17T12:00:00.000Z'],
    ['next_monday_9', '2026-01-19T07:00:00.000Z'],
  ] as const)('%s moves the due date to %s', async (preset, expected) => {
    await serviceWith('pending').reschedule(TASK_ID, 'agency-1', { preset });
    expect(taskUpdates()).toEqual([{ table: 'tasks', op: 'update', values: { due_at: expected } }]);
  });

  it('next Monday from a Monday is the Monday after', async () => {
    vi.setSystemTime(new Date('2026-01-19T08:00:00Z'));
    await serviceWith('pending').reschedule(TASK_ID, 'agency-1', { preset: 'next_monday_9' });
    expect(taskUpdates()[0].values).toEqual({ due_at: '2026-01-26T07:00:00.000Z' });
  });

  it('tomorrow 09:00 across the spring DST change is 06:00Z', async () => {
    vi.setSystemTime(new Date('2026-03-28T10:00:00Z'));
    await serviceWith('pending').reschedule(TASK_ID, 'agency-1', { preset: 'tomorrow_9' });
    expect(taskUpdates()[0].values).toEqual({ due_at: '2026-03-29T06:00:00.000Z' });
  });

  it('a custom date is read in agency time', async () => {
    await serviceWith('pending').reschedule(TASK_ID, 'agency-1', { due_at: '2026-01-20T14:00' });
    expect(taskUpdates()[0].values).toEqual({ due_at: '2026-01-20T12:00:00.000Z' });
  });
});

describe('TaskService pending-only guards', () => {
  it.each(['completed', 'cancelled'] as const)('refuses to reschedule a %s task', async (status) => {
    const service = serviceWith(status);
    await expect(service.reschedule(TASK_ID, 'agency-1', { preset: 'plus_1h' })).rejects.toEqual(
      new DomainError('errors.task_not_pending')
    );
    expect(taskUpdates()).toEqual([]);
  });

  it.each(['completed', 'cancelled'] as const)('refuses to cancel a %s task', async (status) => {
    const service = serviceWith(status);
    await expect(service.cancel(TASK_ID, 'agency-1', {})).rejects.toEqual(new DomainError('errors.task_not_pending'));
    expect(taskUpdates()).toEqual([]);
  });

  it.each(['completed', 'cancelled'] as const)('refuses to edit a %s task', async (status) => {
    const service = serviceWith(status);
    await expect(service.update(TASK_ID, 'agency-1', { title: 'New' })).rejects.toEqual(
      new DomainError('errors.task_not_pending')
    );
    expect(taskUpdates()).toEqual([]);
  });

  it('refuses to complete a task twice', async () => {
    const service = serviceWith('completed');
    await expect(service.completeWithNext(TASK_ID, 'agency-1', 'user-1', { outcome: 'Done' })).rejects.toEqual(
      new DomainError('errors.task_not_pending')
    );
    expect(taskUpdates()).toEqual([]);
  });

  it('refuses a custom reschedule date that is not a date', async () => {
    const service = serviceWith('pending');
    const error = await service.reschedule(TASK_ID, 'agency-1', { due_at: '' }).catch((e) => e);
    expect(error).toBeInstanceOf(ZodError);
    expect((error as ZodError).issues.map((i) => i.message)).toEqual(['validation.invalid_date']);
    expect(taskUpdates()).toEqual([]);
  });

  it('refuses an unknown reschedule preset', async () => {
    const service = serviceWith('pending');
    const input = { preset: 'next_year' } as unknown as RescheduleTaskInput;
    await expect(service.reschedule(TASK_ID, 'agency-1', input)).rejects.toBeInstanceOf(ZodError);
    expect(taskUpdates()).toEqual([]);
  });

  it('cancels a pending task and keeps the reason as its outcome', async () => {
    await serviceWith('pending').cancel(TASK_ID, 'agency-1', { reason: '  Client bought elsewhere ' });
    expect(taskUpdates()).toEqual([
      { table: 'tasks', op: 'update', values: { status: 'cancelled', outcome: 'Client bought elsewhere' } },
    ]);
  });

  it('cancels without a reason', async () => {
    await serviceWith('pending').cancel(TASK_ID, 'agency-1', { reason: '' });
    expect(taskUpdates()[0].values).toEqual({ status: 'cancelled', outcome: null });
  });

  it('edits a pending task, reading the due date in agency time', async () => {
    await serviceWith('pending').update(TASK_ID, 'agency-1', { title: 'Viewing', due_at: '2026-01-15T14:00' });
    expect(taskUpdates()[0].values).toEqual({ title: 'Viewing', due_at: '2026-01-15T12:00:00.000Z' });
  });

  it.each([
    ['completes', (s: TaskService) => s.completeWithNext(TASK_ID, 'agency-1', 'user-1', { outcome: 'Done' })],
    ['cancels', (s: TaskService) => s.cancel(TASK_ID, 'agency-1', {})],
    ['reschedules', (s: TaskService) => s.reschedule(TASK_ID, 'agency-1', { preset: 'plus_1h' })],
  ] as const)('reports a task someone else %s first as no longer pending', async (_verb, act) => {
    fake = createFakeSupabase({ role: 'broker', tables: { tasks: task('pending') }, writesMatchNothing: ['tasks'] });
    const service = new TaskService(fake.client as SupabaseClient, { timezone: SOFIA });
    await expect(act(service)).rejects.toEqual(new DomainError('errors.task_not_pending'));
  });

  it('refuses a task that does not exist in the agency', async () => {
    fake = createFakeSupabase({ role: 'broker', tables: { tasks: null } });
    const service = new TaskService(fake.client as SupabaseClient, { timezone: SOFIA });
    await expect(service.cancel(TASK_ID, 'agency-1', {})).rejects.toEqual(new DomainError('errors.task_not_found'));
  });
});
