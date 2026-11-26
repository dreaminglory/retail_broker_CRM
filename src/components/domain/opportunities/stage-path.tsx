"use client";

import { Check } from "lucide-react";
import type { Stage } from "@/domain/stages/types";
import { cn } from "@/lib/utils";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";

export type StageStep = { stage: Stage; state: "done" | "current" | "todo" };

/**
 * The deal's path (deal.png, "Път на сделката"): the agency's open stages in order, then the
 * closing stage the deal ended in, if it is closed. Before the current stage is done.
 */
export function stagePath(stages: readonly Stage[], currentStageId: string): StageStep[] {
  const open = stages.filter((s) => !s.is_terminal).sort((a, b) => a.sort_order - b.sort_order);
  const current = stages.find((s) => s.id === currentStageId);
  if (!current) return open.map((stage) => ({ stage, state: "todo" }));
  if (current.is_terminal) {
    return [...open.map((stage) => ({ stage, state: "done" as const })), { stage: current, state: "current" }];
  }
  const at = open.findIndex((s) => s.id === current.id);
  return open.map((stage, i) => ({ stage, state: i < at ? "done" : i === at ? "current" : "todo" }));
}

/** A read-only stepper; the stage is changed with the header's controls. */
export function StagePath({ stages, currentStageId, label }: { stages: readonly Stage[]; currentStageId: string; label: string }) {
  const getStageName = useStageTranslation();
  const steps = stagePath(stages, currentStageId);

  return (
    <ol aria-label={label} className="flex overflow-x-auto pb-1 [scrollbar-width:thin]">
      {steps.map(({ stage, state }, i) => (
        <li
          key={stage.id}
          aria-current={state === "current" ? "step" : undefined}
          className="relative flex min-w-24 flex-1 flex-col items-center gap-2 text-center"
        >
          {/* The connector to the previous step: solid when reached. */}
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                "absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2",
                state === "todo" ? "border-t-2 border-dashed border-border-strong bg-transparent" : "bg-primary"
              )}
            />
          )}
          <span className="relative z-10 flex h-7 items-center">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border-2",
                state === "done" && "border-primary bg-primary text-on-primary",
                state === "current" && "size-7 border-primary bg-sea-light ring-4 ring-accent",
                state === "todo" && "border-border-strong bg-surface"
              )}
            >
              {state === "done" && <Check className="size-3.5" aria-hidden />}
            </span>
          </span>
          <span
            className={cn(
              "px-1 text-small",
              state === "current" ? "font-semibold text-ink" : state === "done" ? "text-ink" : "text-muted-foreground"
            )}
          >
            {getStageName(stage.name)}
          </span>
        </li>
      ))}
    </ol>
  );
}
