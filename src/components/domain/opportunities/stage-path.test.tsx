import { describe, expect, it } from 'vitest';
import type { Stage } from '@/domain/stages/types';
import { stagePath } from './stage-path';

const stage = (id: string, sort_order: number, terminal_type: Stage['terminal_type'] = null): Stage => ({
  id,
  agency_id: 'a1',
  name: id,
  sort_order,
  is_terminal: terminal_type !== null,
  terminal_type,
  created_at: '',
  updated_at: '',
});

const STAGES = [stage('won', 9, 'won'), stage('viewing', 2), stage('new', 1), stage('offer', 3), stage('lost', 10, 'lost')];

describe('stagePath (deal page Път tab, ui-bright T10)', () => {
  it("walks the agency's open stages in order: done, current, to do", () => {
    expect(stagePath(STAGES, 'viewing').map((s) => [s.stage.id, s.state])).toEqual([
      ['new', 'done'],
      ['viewing', 'current'],
      ['offer', 'todo'],
    ]);
  });

  it('ends on the closing stage when the deal is closed, every open stage done', () => {
    expect(stagePath(STAGES, 'lost').map((s) => [s.stage.id, s.state])).toEqual([
      ['new', 'done'],
      ['viewing', 'done'],
      ['offer', 'done'],
      ['lost', 'current'],
    ]);
  });

  it('marks nothing done when the stage is unknown', () => {
    expect(stagePath(STAGES, 'gone').every((s) => s.state === 'todo')).toBe(true);
  });
});
