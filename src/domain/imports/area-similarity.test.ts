import { describe, expect, it } from 'vitest';
import { findSimilarArea, isNearDuplicateArea } from './area-similarity';

describe('isNearDuplicateArea', () => {
  it.each([
    ['Лозенец', 'Лозенек', 'one letter changed'],
    ['Лозенец', 'Лозенецц', 'one letter added'],
    ['Лозенец', 'Лозенц', 'one letter dropped'],
    ['Младост 1', 'Младост', 'differs by a digit'],
    ['Младост 1', 'Младост 2', 'differs only by digits'],
    ['Младост1', 'Младост 1', 'differs only by spacing'],
    ['Студентски  град', 'Студентски град', 'double space'],
    ['лозенец', 'Лозенец', 'case only'],
  ])('%s ~ %s (%s)', (a, b) => {
    expect(isNearDuplicateArea(a, b)).toBe(true);
  });

  it.each([
    ['Лозенец', 'Люлин'],
    ['Витоша', 'Бояна'],
    ['Изток', 'Изгрев'],
    ['Център', 'Център Север'],
    ['', ''],
  ])('%s is not close to %s', (a, b) => {
    expect(isNearDuplicateArea(a, b)).toBe(false);
  });
});

describe('findSimilarArea', () => {
  it('returns the first existing area that is close, else null', () => {
    expect(findSimilarArea('Лозенек', ['Изгрев', 'Лозенец', 'Лозенецц'])).toBe('Лозенец');
    expect(findSimilarArea('Бояна', ['Изгрев', 'Лозенец'])).toBeNull();
    expect(findSimilarArea('Бояна', [])).toBeNull();
  });
});
