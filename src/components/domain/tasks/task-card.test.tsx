import { renderToString } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import type { Task } from '@/domain/tasks/types';
import { TaskCard, taskCallTarget } from './task-card';

const base: Task = {
  id: 't1',
  agency_id: 'a1',
  opportunity_id: 'o1',
  contact_id: 'c1',
  inquiry_id: null,
  title: 'Call again: Ivan',
  description: null,
  task_type: 'call',
  due_at: '2026-11-19T10:00:00Z',
  status: 'pending',
  outcome: null,
  completed_at: null,
  assigned_to: 'u1',
  property_id: null,
  created_by: 'u1',
  created_at: '2026-11-19T09:00:00Z',
  updated_at: '2026-11-19T09:00:00Z',
  call_phone: { value: '+359888123456', type: 'phone', name: 'Ivan Petrov' },
  opportunity_status: 'active',
};

function render(task: Task) {
  return renderToString(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Europe/Sofia" now={new Date('2026-11-19T09:30:00Z')}>
      <TaskCard task={task} timeZone="Europe/Sofia" onComplete={() => {}} />
    </NextIntlClientProvider>,
  );
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

describe('TaskCard call links (spec phone-loop rule 1, T8)', () => {
  it('shows Call and the messengers on a pending call task with a phone', () => {
    const html = render(base);

    expect(hrefs(html)).toEqual(expect.arrayContaining(['tel:+359888123456', 'viber://chat?number=%2B359888123456']));
    expect(html).toContain('aria-label="Call Ivan Petrov"');
  });

  it('shows no links on other task types, done tasks or without a phone', () => {
    for (const task of [
      { ...base, task_type: 'viewing' as const },
      { ...base, status: 'completed' as const },
      { ...base, call_phone: null },
    ]) {
      expect(hrefs(render(task)).some((h) => h.startsWith('tel:'))).toBe(false);
    }
  });
});

describe('taskCallTarget (rule 2: a Today task prompts with that task)', () => {
  it("carries the task, its deal, contact and inquiry and the person's name", () => {
    expect(taskCallTarget({ ...base, inquiry_id: 'i1' }, 'Unknown')).toEqual({
      context: { opportunity_id: 'o1', contact_id: 'c1', inquiry_id: 'i1', task_id: 't1' },
      name: 'Ivan Petrov',
      closed: false,
    });
  });

  it('marks a closed deal (rule 8) and falls back to the unknown name', () => {
    const target = taskCallTarget({ ...base, opportunity_status: 'won', call_phone: { value: '+359888123456', type: 'phone', name: null } }, 'Unknown');
    expect(target.closed).toBe(true);
    expect(target.name).toBe('Unknown');
  });

  it('is not closed for a task without a deal', () => {
    expect(taskCallTarget({ ...base, opportunity_id: null, opportunity_status: null }, 'Unknown').closed).toBe(false);
  });
});

describe('TaskCard as the Today row (ui-bright T8)', () => {
  it('opens completion from a checkbox-style button named Complete', () => {
    const html = render(base);
    expect(html).toMatch(/<button[^>]*aria-label="Complete"[^>]*data-slot="task-check"/);
  });

  it('colours only the overdue time red; a later task stays neutral', () => {
    const overdue = render({ ...base, due_at: '2026-11-18T10:00:00Z' });
    const later = render({ ...base, due_at: '2026-11-21T10:00:00Z' });
    expect(overdue).toContain('text-overdue');
    expect(later).not.toMatch(/text-(overdue|due|at-risk)\b/);
    expect(later).not.toMatch(/bg-(overdue|due)-soft/);
  });

  it('shows the time with tabular figures', () => {
    expect(render({ ...base, due_at: '2026-11-19T15:30:00Z' })).toMatch(/tabular-nums[^>]*>[^<]*(17:30|05:30 PM)/);
  });
});
