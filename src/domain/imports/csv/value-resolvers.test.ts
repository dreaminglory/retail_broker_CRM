import { describe, expect, it } from 'vitest';
import { UNKNOWN_MEMBER_NAME } from '@/domain/members/types';
import { resolveAssignee } from './value-resolvers';

const ivan = { user_id: 'ivan', email: 'ivan@alpha.bg', display_name: 'Ivan Petrov' };
const maria = { user_id: 'maria', email: 'maria@alpha.bg', display_name: 'Maria Georgieva' };
const otherIvan = { user_id: 'other-ivan', email: 'other.ivan@alpha.bg', display_name: 'Ivan Petrov' };

describe('resolveAssignee', () => {
  it('finds a member by name, ignoring case and spaces', () => {
    expect(resolveAssignee('  maria georgieva ', [ivan, maria])).toBe('maria');
  });

  it('finds a member by email', () => {
    expect(resolveAssignee('MARIA@alpha.bg', [ivan, maria])).toBe('maria');
  });

  it('returns the default for an unknown value', () => {
    expect(resolveAssignee('No Such Person', [ivan, maria], 'fallback')).toBe('fallback');
    expect(resolveAssignee('No Such Person', [ivan, maria])).toBeNull();
  });

  it('refuses to guess when two members share a name', () => {
    expect(resolveAssignee('Ivan Petrov', [ivan, otherIvan])).toBeNull();
  });

  it('still finds one of two namesakes by email', () => {
    expect(resolveAssignee('other.ivan@alpha.bg', [ivan, otherIvan])).toBe('other-ivan');
  });

  it('never matches the placeholder shown for a nameless member', () => {
    const nameless = { user_id: 'nameless', email: null, display_name: UNKNOWN_MEMBER_NAME };

    expect(resolveAssignee(UNKNOWN_MEMBER_NAME, [nameless])).toBeNull();
  });
});
