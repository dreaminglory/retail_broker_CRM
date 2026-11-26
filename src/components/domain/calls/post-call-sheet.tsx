"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PostCallForm, type PostCallTarget } from "./post-call-form";

export { PostCallForm, type CallDeal, type PostCallTarget } from "./post-call-form";

type PostCallSheetProps = {
  target: PostCallTarget | null;
  /** The agency's timezone: "today 18:00" is offered before 17:00 there (rule 5). */
  timeZone: string;
  onClose: () => void;
};

/**
 * "Did you reach <name>?" (spec phone-loop rule 5): a bottom sheet on a phone, a dialog on a
 * desktop. One save logs the call and its next action or retry; "Not now" writes nothing.
 */
export function PostCallSheet({ target, timeZone, onClose }: PostCallSheetProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[90dvh] overflow-y-auto sm:max-w-md",
          // Bottom sheet below `sm`, within thumb reach (spec Screens).
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {target && <PostCallForm key={JSON.stringify(target.context)} target={target} timeZone={timeZone} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

