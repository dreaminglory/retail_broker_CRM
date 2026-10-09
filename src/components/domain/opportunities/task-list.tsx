"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TaskCompleteDialog } from "../tasks/task-complete-dialog";
import type { Task, CompleteTaskWithNextInput } from "@/domain/tasks/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { ActionResult } from "@/lib/actions";
import { BrokerSelect } from "@/components/domain/members/broker-select";
import { Plus, Calendar, CheckCircle2, Circle } from "lucide-react";
import { isPast } from "date-fns";
import { useTranslations, useFormatter } from "next-intl";

interface TaskListProps {
  opportunityId: string;
  tasks: Task[];
  brokers: ActiveBroker[];
  createAction: (
    opportunityId: string,
    prevState: ActionResult,
    formData: FormData
  ) => Promise<ActionResult<{ id: string }>>;
  completeAction: (
    id: string,
    opportunityId: string,
    prevState: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;
}

const initialState: ActionResult<{ id: string }> = { success: false, error: "" };
const completeInitialState: ActionResult = { success: false, error: "" };

export function TaskList({
  opportunityId,
  tasks,
  brokers,
  createAction,
  completeAction,
}: TaskListProps) {
  const t = useTranslations("OpportunityTaskList");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Task | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const [state, formAction, pending] = useActionState(
    createAction.bind(null, opportunityId) as (
      prevState: ActionResult<{ id: string }>,
      formData: FormData
    ) => Promise<ActionResult<{ id: string }>>,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      setTimeout(() => {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      }, 0);
    }
  }, [state.success, router]);

  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          {t("title")} ({pendingTasks.length} {t("pending")})
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="h-8">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("addBtn")}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("addTitle")}</DialogTitle>
            </DialogHeader>
            <form ref={formRef} action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  {t("taskTitleLabel")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  maxLength={150}
                  placeholder={t("taskTitlePlaceholder")}
                  required
                  aria-invalid={!!fieldErrors?.title}
                />
                {fieldErrors?.title && (
                  <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="due_at">{t("dueAtLabel")}</Label>
                <Input
                  id="due_at"
                  name="due_at"
                  type="datetime-local"
                  aria-invalid={!!fieldErrors?.due_at}
                />
                {fieldErrors?.due_at && (
                  <p className="text-xs text-destructive">{fieldErrors.due_at[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">{t("descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  name="description"
                  maxLength={1000}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assigned_to">{t("assignedToLabel")}</Label>
                <BrokerSelect
                  name="assigned_to"
                  brokers={brokers}
                />
                {fieldErrors?.assigned_to && (
                  <p className="text-xs text-destructive">{fieldErrors.assigned_to[0]}</p>
                )}
              </div>

              {!state.success && state.error && !state.fieldErrors && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? t("addingBtn") : t("submitAdd")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {pendingTasks.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            {t("noPendingTasks")}
          </div>
        ) : (
          <div className="rounded-md border divide-y bg-card">
            {pendingTasks.map((task) => {
              const overdue = task.due_at && isPast(new Date(task.due_at));
              return (
                <div key={task.id} className="flex items-start gap-3 p-3">
                  <button
                    onClick={() => setCompleteTarget(task)}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    {task.due_at && (
                      <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        <Calendar className="h-3.5 w-3.5" />
                        {format.dateTime(new Date(task.due_at), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {overdue && <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1 py-0">{t("overdue")}</Badge>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("completedSection")}
            </h4>
            <div className="space-y-2 opacity-70">
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm line-through">{task.title}</p>
                    {task.outcome && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("outcomeLabel")}: {task.outcome}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* Complete Task Dialog */}
      <TaskCompleteDialog
        open={!!completeTarget}
        onOpenChange={(o: boolean) => {
          if (!o) {
            setCompleteTarget(null);
            setCompleteError("");
          }
        }}
        task={completeTarget}
        brokers={brokers}
        completeAction={async (taskId: string, input: CompleteTaskWithNextInput) => {
          if (!completeTarget) return { success: false, error: "No target task" };
          setCompleting(true);
          setCompleteError("");
          try {
            // Convert 'input' back to FormData and call 'completeAction'
            const formData = new FormData();
            formData.append("outcome", input.outcome);
            if (input.new_stage_id) {
              formData.append("new_stage_id", input.new_stage_id);
            }
            if (input.next_task) {
              formData.append("next_task", JSON.stringify(input.next_task));
            }
            const result = await completeAction(
              completeTarget.id,
              opportunityId,
              completeInitialState,
              formData
            );
            if (result.success) {
              setCompleteTarget(null);
              router.refresh();
              return { success: true, data: undefined };
            } else {
              setCompleteError(result.error || "Validation failed");
              return { success: false, error: result.error || "Validation failed" };
            }
          } catch (err) {
            setCompleteError("An unexpected error occurred");
            return { success: false, error: "An unexpected error occurred" };
          } finally {
            setCompleting(false);
          }
        }}
      />
    </div>
  );
}
