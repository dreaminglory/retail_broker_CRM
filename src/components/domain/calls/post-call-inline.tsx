"use client";

import { useCallback, useEffect } from "react";
import { PostCallForm } from "./post-call-form";
import { useCallIntent, usePostCallTarget } from "./use-call-intent";

/**
 * Claims these tasks for the page (ui-bright T9): a call on one of them opens its prompt inline
 * via `PostCallInline` instead of the sheet. Released on unmount, so leaving the page brings the
 * sheet back for the same call.
 */
export function useClaimPostCallTasks(taskIds: readonly string[]) {
  const intent = useCallIntent();
  const key = taskIds.join(",");
  useEffect(() => intent?.claim(key ? key.split(",") : []), [intent, key]);
}

/**
 * The post-call prompt under its Today task row (today.png): the same form and the same single
 * save as the sheet. Renders nothing unless the current call is on this task.
 */
export function PostCallInline({ taskId, timeZone }: { taskId: string; timeZone: string }) {
  const intent = useCallIntent();
  const target = usePostCallTarget();
  // Coming back from a call on a phone: bring the prompt into view.
  const reveal = useCallback((el: HTMLDivElement | null) => {
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  if (!intent || !target || target.context.task_id !== taskId) return null;

  return (
    <div ref={reveal} className="mx-3 mb-3 rounded-lg border border-primary bg-surface p-4 shadow-float sm:mx-5">
      <PostCallForm
        key={JSON.stringify(target.context)}
        layout="inline"
        target={target}
        timeZone={timeZone}
        onDone={intent.close}
      />
    </div>
  );
}
