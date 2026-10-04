"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TASK_TYPE_CONFIG } from "./task-card";
import type { Task, TaskType } from "@/domain/tasks/types";
import type { Stage } from "@/domain/stages/types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { ActionResult } from "@/lib/actions";
import type { CompleteTaskWithNextInput } from "@/domain/tasks/types";
import { TASK_TYPES } from "@/domain/tasks/validation";
import type { ActiveBroker } from "@/domain/members/types";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import { ChevronDown, ChevronUp, CalendarPlus, ArrowRightCircle } from "lucide-react";

interface TaskCompleteDialogProps {
  task: Task | null;
  stages?: Stage[];
  brokers?: ActiveBroker[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completeAction: (taskId: string, input: CompleteTaskWithNextInput) => Promise<ActionResult<any>>;
}

export function TaskCompleteDialog({
  task,
  stages = [],
  brokers = [],
  open,
  onOpenChange,
  completeAction,
}: TaskCompleteDialogProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("");
  const [showNextTask, setShowNextTask] = useState(false);
  const [showStageChange, setShowStageChange] = useState(false);
  const [nextTitle, setNextTitle] = useState("");
  const [nextType, setNextType] = useState<TaskType | "">("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [nextAssignedTo, setNextAssignedTo] = useState(task?.assigned_to ?? "none");
  const [newStageId, setNewStageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Non-terminal stages only for stage change
  const activeStages = stages.filter((s) => !s.is_terminal);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome.trim()) {
      setError("Please describe what happened");
      return;
    }

    setLoading(true);
    setError("");

    const input: CompleteTaskWithNextInput = {
      outcome: outcome.trim(),
    };

    if (!task) return;

    if (showNextTask && nextTitle.trim()) {
      input.next_task = {
        title: nextTitle.trim(),
        task_type: (nextType as TaskType) || null,
        due_at: nextDueAt || null,
        opportunity_id: task.opportunity_id,
        assigned_to: nextAssignedTo === "none" ? null : nextAssignedTo,
      };
    }

    if (showStageChange && newStageId) {
      input.new_stage_id = newStageId;
    }

    const result = await completeAction(task.id, input);

    if (result.success) {
      // Reset form
      setOutcome("");
      setNextTitle("");
      setNextType("");
      setNextDueAt("");
      setNewStageId("");
      setShowNextTask(false);
      setShowStageChange(false);
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error);
    }

    setLoading(false);
  }

  function handleClose() {
    setError("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
          <DialogDescription className="text-sm">
            Record what happened with &ldquo;{task?.title}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Required: Outcome */}
          <div className="space-y-2">
            <Label htmlFor="outcome" className="text-sm font-medium">
              What happened? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="outcome"
              placeholder="Spoke with client, they're interested in viewing the property next week..."
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
              className="resize-none"
              autoFocus
            />
          </div>

          {/* Optional: Schedule Next Action */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium"
              onClick={() => setShowNextTask(!showNextTask)}
            >
              <span className="flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-primary" />
                Schedule next action
              </span>
              {showNextTask ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showNextTask && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="next-title" className="text-xs">Task title</Label>
                  <Input
                    id="next-title"
                    placeholder="Follow up call after viewing"
                    value={nextTitle}
                    onChange={(e) => setNextTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="next-type" className="text-xs">Type</Label>
                    <Select value={nextType} onValueChange={(v) => setNextType(v as TaskType)}>
                      <SelectTrigger id="next-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map((t) => {
                          const config = TASK_TYPE_CONFIG[t];
                          const Icon = config.icon;
                          return (
                            <SelectItem key={t} value={t}>
                              <span className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5" />
                                {config.label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="next-due" className="text-xs">Due date</Label>
                    <Input
                      id="next-due"
                      type="datetime-local"
                      value={nextDueAt}
                      onChange={(e) => setNextDueAt(e.target.value)}
                    />
                  </div>
                </div>

                {brokers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="next-assigned-to" className="text-xs">Assign to</Label>
                    <BrokerSelect
                      name="next_assigned_to"
                      brokers={brokers}
                      value={nextAssignedTo}
                      onValueChange={setNextAssignedTo}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Optional: Change Stage */}
          {activeStages.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium"
                onClick={() => setShowStageChange(!showStageChange)}
              >
                <span className="flex items-center gap-2">
                  <ArrowRightCircle className="h-4 w-4 text-primary" />
                  Advance stage
                </span>
                {showStageChange ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showStageChange && (
                <div className="mt-3 border-t pt-3">
                  <Select value={newStageId} onValueChange={(val) => setNewStageId(val ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new stage">
                        {(val) => activeStages.find((s) => s.id === val)?.name ?? "Select new stage"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Complete Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
