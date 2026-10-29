import { describe, expect, it } from 'vitest';
import { actionErrorMessage } from './action-errors';

describe('actionErrorMessage', () => {
  it("shows a field's own message rather than the generic validation error", () => {
    expect(
      actionErrorMessage({ success: false, error: 'Please check the highlighted fields.', fieldErrors: { outcome: ['This text is too long.'] } })
    ).toBe('This text is too long.');
  });

  it('falls back to the action error when no field failed', () => {
    expect(actionErrorMessage({ success: false, error: 'This task is already completed or cancelled.' })).toBe(
      'This task is already completed or cancelled.'
    );
    expect(actionErrorMessage({ success: false, error: 'Failed', fieldErrors: {} })).toBe('Failed');
  });
});
