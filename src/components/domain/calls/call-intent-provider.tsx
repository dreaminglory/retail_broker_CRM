"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PostCallSheet, type PostCallTarget } from "./post-call-sheet";
import { CALL_INTENT } from "./call-intent-constants";
import {
  CallIntentContext,
  PostCallTargetContext,
  createCallIntentTracker,
  sheetTarget,
  type CallIntentApi,
  type CallIntentTracker,
  type IntentStorage,
} from "./use-call-intent";

const TOAST_ID = "call-intent";

function sessionStorageOrNull(): IntentStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Mounted once in the dashboard layout: turns a tapped Call, Viber or WhatsApp link into the
 * post-call prompt on return, or a "Log the call" toast on a desktop (spec phone-loop rule 3).
 */
export function CallIntentProvider({ children, timeZone }: { children: React.ReactNode; timeZone: string }) {
  const t = useTranslations("phoneLoop.intent");
  const [target, setTarget] = useState<PostCallTarget | null>(null);
  // Task ids a page renders the prompt for itself (Today, inline under the row).
  const [claims, setClaims] = useState<readonly { id: number; taskIds: readonly string[] }[]>([]);
  const claimSeq = useRef(0);
  const tracker = useRef<CallIntentTracker | null>(null);

  // The toast text reads the latest translations without re-creating the tracker.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const instance = createCallIntentTracker({
      storage: sessionStorageOrNull(),
      now: () => Date.now(),
      onPrompt: (intent) => setTarget(intent.target),
      onToast: (intent) =>
        toast(tRef.current("toast", { name: intent.target.name }), {
          id: TOAST_ID,
          duration: CALL_INTENT.toastMs,
          action: { label: tRef.current("log"), onClick: () => setTarget(intent.target) },
        }),
      onClearToast: () => toast.dismiss(TOAST_ID),
    });
    tracker.current = instance;

    const onVisibility = () => instance.visibility(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    // After hydration: a page the browser discarded during the call reopens the prompt.
    const resume = setTimeout(() => instance.resume(), 0);

    return () => {
      clearTimeout(resume);
      document.removeEventListener("visibilitychange", onVisibility);
      instance.dispose();
      tracker.current = null;
    };
  }, []);

  // Saved, "Not now" or closed: the intent is done either way.
  const close = useCallback(() => {
    tracker.current?.clear();
    setTarget(null);
  }, []);

  const api = useMemo<CallIntentApi>(
    () => ({
      register: (intentTarget) => tracker.current?.register(intentTarget),
      open: (openTarget) => setTarget(openTarget),
      close,
      claim: (taskIds) => {
        const id = ++claimSeq.current;
        setClaims((current) => [...current, { id, taskIds }]);
        return () => setClaims((current) => current.filter((c) => c.id !== id));
      },
    }),
    [close],
  );

  const forSheet = sheetTarget(
    target,
    claims.map((c) => c.taskIds),
  );

  return (
    <CallIntentContext.Provider value={api}>
      <PostCallTargetContext.Provider value={target}>
        {children}
        <PostCallSheet target={forSheet} timeZone={timeZone} onClose={close} />
      </PostCallTargetContext.Provider>
    </CallIntentContext.Provider>
  );
}
