"use client";

import { createContext, useContext } from "react";
import type { CallChannel } from "@/domain/calls/types";
import type { PostCallTarget } from "./post-call-sheet";
import { CALL_INTENT } from "./call-intent-constants";

/**
 * The pending call intent (spec phone-loop rule 3, AD-065): a tap on Call, Viber or WhatsApp
 * is remembered, and coming back to the tab after a real absence opens the post-call prompt.
 * If the page never hides (desktop, a `tel:` confirmation), a toast offers to log instead.
 *
 * The tracker is plain logic over injected storage and time, so it is tested with fake timers;
 * the provider wires it to `visibilitychange`, `sessionStorage` and the sheet.
 */

export type CallIntentTarget = PostCallTarget & { channel: CallChannel };

export type CallIntent = {
  target: CallIntentTarget;
  tappedAt: number;
  /** When the page last went hidden after the tap; null while it is visible. */
  hiddenAt: number | null;
};

export type IntentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type TrackerDeps = {
  storage: IntentStorage | null;
  now: () => number;
  onPrompt: (intent: CallIntent) => void;
  onToast: (intent: CallIntent) => void;
  onClearToast: () => void;
};

export type CallIntentTracker = ReturnType<typeof createCallIntentTracker>;

export function createCallIntentTracker(deps: TrackerDeps) {
  // Memory is the fallback when storage is missing or throws (private mode, blocked site data).
  let memory: CallIntent | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function read(): CallIntent | null {
    try {
      const raw = deps.storage?.getItem(CALL_INTENT.storageKey);
      return raw ? (JSON.parse(raw) as CallIntent) : memory;
    } catch {
      return memory;
    }
  }

  function write(intent: CallIntent): void {
    memory = intent;
    try {
      deps.storage?.setItem(CALL_INTENT.storageKey, JSON.stringify(intent));
    } catch {
      // Memory keeps it for this page; drop an older stored tap so it can't win over memory.
      try {
        deps.storage?.removeItem(CALL_INTENT.storageKey);
      } catch {
        // Nothing stored.
      }
    }
  }

  function remove(): void {
    memory = null;
    try {
      deps.storage?.removeItem(CALL_INTENT.storageKey);
    } catch {
      // Nothing stored.
    }
  }

  function cancelToastTimer(): void {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
  }

  /** The stored intent, unless it is older than the limit (then it is forgotten). */
  function current(): CallIntent | null {
    const intent = read();
    if (intent && deps.now() - intent.tappedAt > CALL_INTENT.maxAgeMs) {
      remove();
      return null;
    }
    return intent;
  }

  function prompt(intent: CallIntent): void {
    cancelToastTimer();
    deps.onClearToast();
    write({ ...intent, hiddenAt: null });
    deps.onPrompt(intent);
  }

  return {
    /** A tap on Call, Viber or WhatsApp: the newest tap replaces any earlier one. */
    register(target: CallIntentTarget): void {
      cancelToastTimer();
      deps.onClearToast();
      const tappedAt = deps.now();
      write({ target, tappedAt, hiddenAt: null });
      toastTimer = setTimeout(() => {
        toastTimer = null;
        const intent = current();
        if (intent && intent.tappedAt === tappedAt && intent.hiddenAt === null) deps.onToast(intent);
      }, CALL_INTENT.hideWithinMs);
    },

    /** `document.visibilityState` changed. */
    visibility(hidden: boolean): void {
      const intent = current();
      if (!intent) return;
      if (hidden) {
        if (intent.hiddenAt === null) write({ ...intent, hiddenAt: deps.now() });
        return;
      }
      if (intent.hiddenAt === null) return;
      if (deps.now() - intent.hiddenAt >= CALL_INTENT.minHiddenMs) prompt(intent);
      else write({ ...intent, hiddenAt: null });
    },

    /** On page load: the browser may have discarded the page during the call. */
    resume(): void {
      const intent = current();
      if (intent?.hiddenAt != null && deps.now() - intent.hiddenAt >= CALL_INTENT.minHiddenMs) prompt(intent);
    },

    /** The call was logged or the broker chose "Not now". */
    clear(): void {
      cancelToastTimer();
      deps.onClearToast();
      remove();
    },

    dispose(): void {
      cancelToastTimer();
    },
  };
}

export type CallIntentApi = {
  /** Remember a tap on Call, Viber or WhatsApp. */
  register: (target: CallIntentTarget) => void;
  /** Open the prompt now ("Log call", the toast's Log button). */
  open: (target: PostCallTarget) => void;
};

export const CallIntentContext = createContext<CallIntentApi | null>(null);

/** Null outside the dashboard (and in tests): links then just open. */
export function useCallIntent(): CallIntentApi | null {
  return useContext(CallIntentContext);
}
