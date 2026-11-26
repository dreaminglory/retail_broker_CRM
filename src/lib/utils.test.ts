import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn with the Bright type scale and shadows (AD-066)', () => {
  it('keeps a type-scale size next to a text colour', () => {
    expect(cn('text-ink', 'text-title')).toBe('text-ink text-title');
    expect(cn('text-muted-foreground text-small', 'text-overdue')).toBe('text-small text-overdue');
  });

  it('lets a later type-scale size replace an earlier one', () => {
    expect(cn('text-sm', 'text-body')).toBe('text-body');
    expect(cn('text-display', 'text-num-lg')).toBe('text-num-lg');
  });

  it('treats shadow-action and shadow-float as shadows, not shadow colours', () => {
    expect(cn('shadow-sm', 'shadow-action')).toBe('shadow-action');
    expect(cn('shadow-float', 'shadow-none')).toBe('shadow-none');
  });
});
