import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALL_INTENT } from './call-intent-constants';
import { createCallIntentTracker, type CallIntent, type IntentStorage } from './use-call-intent';

const INQUIRY = '11111111-1111-4111-8111-111111111111';
const target = { context: { inquiry_id: INQUIRY }, name: 'Ivan Petrov', channel: 'phone' as const };

function memoryStorage(): IntentStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('call intent (spec phone-loop rule 3)', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let prompts: CallIntent[];
  let toasts: CallIntent[];
  let toastsCleared: number;

  const tracker = () =>
    createCallIntentTracker({
      storage,
      now: () => Date.now(),
      onPrompt: (i) => prompts.push(i),
      onToast: (i) => toasts.push(i),
      onClearToast: () => toastsCleared++,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
    storage = memoryStorage();
    prompts = [];
    toasts = [];
    toastsCleared = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('prompts on return after the page was hidden for at least 5 s', () => {
    const t = tracker();
    t.register(target);
    t.visibility(true);
    vi.advanceTimersByTime(CALL_INTENT.minHiddenMs);
    t.visibility(false);

    expect(prompts).toEqual([expect.objectContaining({ target })]);
    expect(toasts).toEqual([]);
  });

  it('does not prompt for a glance away shorter than 5 s, and keeps waiting', () => {
    const t = tracker();
    t.register(target);
    t.visibility(true);
    vi.advanceTimersByTime(CALL_INTENT.minHiddenMs - 1);
    t.visibility(false);
    expect(prompts).toEqual([]);

    t.visibility(true);
    vi.advanceTimersByTime(60_000);
    t.visibility(false);
    expect(prompts).toHaveLength(1);
  });

  it('forgets a tap older than 2 h', () => {
    const t = tracker();
    t.register(target);
    t.visibility(true);
    vi.advanceTimersByTime(CALL_INTENT.maxAgeMs + 1);
    t.visibility(false);

    expect(prompts).toEqual([]);
    expect(storage.data.size).toBe(0);
  });

  it('shows the toast if the page does not hide within 3 s (desktop)', () => {
    const t = tracker();
    t.register(target);
    vi.advanceTimersByTime(CALL_INTENT.hideWithinMs - 1);
    expect(toasts).toEqual([]);
    vi.advanceTimersByTime(1);

    expect(toasts).toEqual([expect.objectContaining({ target })]);
    expect(prompts).toEqual([]);
  });

  it('shows no toast when the page hides in time', () => {
    const t = tracker();
    t.register(target);
    vi.advanceTimersByTime(1_000);
    t.visibility(true);
    vi.advanceTimersByTime(CALL_INTENT.hideWithinMs);

    expect(toasts).toEqual([]);
  });

  it('lets the newest tap win', () => {
    const t = tracker();
    t.register(target);
    const other = { ...target, name: 'Maria', channel: 'viber' as const };
    t.register(other);
    t.visibility(true);
    vi.advanceTimersByTime(10_000);
    t.visibility(false);

    expect(prompts).toEqual([expect.objectContaining({ target: other })]);
    // The first tap's toast timer was cancelled.
    vi.advanceTimersByTime(CALL_INTENT.hideWithinMs);
    expect(toasts).toEqual([]);
  });

  it('prompts once, and nothing after the intent is cleared (save or Not now)', () => {
    const t = tracker();
    t.register(target);
    t.visibility(true);
    vi.advanceTimersByTime(10_000);
    t.visibility(false);
    t.clear();
    t.visibility(true);
    vi.advanceTimersByTime(10_000);
    t.visibility(false);

    expect(prompts).toHaveLength(1);
    expect(storage.data.size).toBe(0);
    expect(toastsCleared).toBeGreaterThan(0);
  });

  it('dismisses the toast when the prompt opens', () => {
    const t = tracker();
    t.register(target);
    vi.advanceTimersByTime(CALL_INTENT.hideWithinMs);
    expect(toasts).toHaveLength(1);
    t.visibility(true);
    vi.advanceTimersByTime(10_000);
    t.visibility(false);

    expect(prompts).toHaveLength(1);
    expect(toastsCleared).toBeGreaterThan(0);
  });

  it('resumes after a reload: a stored intent hidden long enough prompts on start', () => {
    const first = tracker();
    first.register(target);
    first.visibility(true);
    vi.advanceTimersByTime(30_000);

    // The browser discarded the page during the call and reloads it now.
    const second = tracker();
    second.resume();

    expect(prompts).toEqual([expect.objectContaining({ target })]);
  });

  it('stores ids and the name only, never a phone number (rule 12)', () => {
    const t = tracker();
    t.register(target);
    const [stored] = [...storage.data.values()];

    // Exactly the ids, the name and the channel: no field that could hold a number.
    expect(JSON.parse(stored)).toEqual({
      target: { context: { inquiry_id: INQUIRY }, name: 'Ivan Petrov', channel: 'phone' },
      tappedAt: Date.now(),
      hiddenAt: null,
    });
  });

  it('survives a storage that throws (private mode)', () => {
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    storage.getItem = () => {
      throw new Error('SecurityError');
    };
    const t = tracker();
    t.register(target);
    t.visibility(true);
    vi.advanceTimersByTime(10_000);
    t.visibility(false);

    expect(prompts).toHaveLength(1);
  });
});
