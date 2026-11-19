import { describe, expect, it } from 'vitest';
import bg from '../../../../messages/bg.json';
import en from '../../../../messages/en.json';
import { translateOutcome } from './task-outcome';

const lookup = (messages: Record<string, unknown>) => (key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages) as string;

describe('translateOutcome (phone-loop, Phase 1 review)', () => {
  it('translates the dismiss cancellation the trigger writes as a key', () => {
    expect(translateOutcome('phoneLoop.cancelledByDismiss', lookup(en))).toBe('Cancelled: the inquiry was dismissed');
    expect(translateOutcome('phoneLoop.cancelledByDismiss', lookup(bg))).toBe('Отменена: запитването е отхвърлено');
  });

  it("leaves a broker's own outcome alone, even one that looks like a key", () => {
    expect(translateOutcome('Spoke with the buyer', lookup(en))).toBe('Spoke with the buyer');
    expect(translateOutcome('phoneLoop.sheet.save', lookup(en))).toBe('phoneLoop.sheet.save');
  });
});
