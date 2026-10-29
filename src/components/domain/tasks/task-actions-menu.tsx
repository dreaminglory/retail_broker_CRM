"use client";

/**
 * Task menu (Sprint 6.2, FR-TSK-08): edit, reschedule presets and cancel
 * with an optional reason. Shown on pending tasks on Today and the
 * opportunity page. Presets are computed on the server in agency time.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarClock, Edit2, MoreVertical, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { BrokerSelect } from "@/components/domain/members/broker-select";
import { RESCHEDULE_PRESETS, type ReschedulePreset } from "@/domain/tasks/reschedule";
import { TASK_TYPES } from "@/domain/tasks/validation";
import type { CancelTaskInput, RescheduleTaskInput, Task, TaskType, UpdateTaskInput } from "@/domain/tasks/types";
import type { ActiveBroker } from "@/domain/members/types";
import type { ActionResult } from "@/lib/actions";
import { toAgencyLocalInput } from "@/lib/time/agency-day";
import {
  cancelTaskAction,
  rescheduleTaskAction,
  updateTaskAction,
} from "@/app/(dashboard)/opportunities/[id]/tasks/actions";

type TaskActionsMenuProps = {
  task: Task;
  timeZone: string;
  brokers: ActiveBroker[];
};

export function TaskActionsMenu({ task, timeZone, brokers }: TaskActionsMenuProps) {
  const t = useTranslations("TaskActions");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<ActionResult>, success: string) {
    setBusy(true);
    try {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return false;
      }
      toast.success(success);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const reschedule = (input: RescheduleTaskInput) =>
    run(() => rescheduleTaskAction(task.id, input), t("rescheduled"));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          aria-label={t("openMenu")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:bg-accent outline-none"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5" />
              {t("rescheduleLabel")}
            </DropdownMenuLabel>
            {RESCHEDULE_PRESETS.map((preset: ReschedulePreset) => (
              <DropdownMenuItem key={preset} onClick={() => reschedule({ preset })}>
                {t(`presets.${preset}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setCancelling(true)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {t("cancelTask")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <EditTaskDialog
          task={task}
          timeZone={timeZone}
          brokers={brokers}
          busy={busy}
          onClose={() => setEditing(false)}
          onSubmit={async (input) => {
            if (await run(() => updateTaskAction(task.id, input), t("saved"))) setEditing(false);
          }}
        />
      )}

      {cancelling && (
        <CancelTaskDialog
          task={task}
          busy={busy}
          onClose={() => setCancelling(false)}
          onSubmit={async (input) => {
            if (await run(() => cancelTaskAction(task.id, input), t("cancelled"))) setCancelling(false);
          }}
        />
      )}
    </>
  );
}

function EditTaskDialog({
  task,
  timeZone,
  brokers,
  busy,
  onClose,
  onSubmit,
}: {
  task: Task;
  timeZone: string;
  brokers: ActiveBroker[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTaskInput) => void;
}) {
  const t = useTranslations("TaskActions");
  const types = useTranslations("TaskCard");
  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState<TaskType | "">(task.task_type ?? "");
  const [dueAt, setDueAt] = useState(task.due_at ? toAgencyLocalInput(task.due_at, timeZone) : "");
  const [description, setDescription] = useState(task.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "none");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              title: title.trim(),
              task_type: taskType || null,
              due_at: dueAt,
              description: description.trim() || null,
              assigned_to: assignedTo === "none" ? null : assignedTo,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-title">
              {t("fields.title")} <span className="text-destructive">*</span>
            </Label>
            <Input id="edit-task-title" value={title} maxLength={300} required onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-type">{t("fields.type")}</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType((v as TaskType) ?? "")}>
                <SelectTrigger id="edit-task-type" className="w-full">
                  <SelectValue placeholder={t("fields.typePlaceholder")}>
                    {(val) => (val ? types(`types.${val as TaskType}`) : t("fields.typePlaceholder"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {types(`types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-task-due">{t("fields.dueAt")}</Label>
              <Input id="edit-task-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-description">{t("fields.description")}</Label>
            <Textarea
              id="edit-task-description"
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {brokers.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("fields.assignedTo")}</Label>
              <BrokerSelect name="assigned_to" brokers={brokers} value={assignedTo} onValueChange={setAssignedTo} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("close")}
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelTaskDialog({
  task,
  busy,
  onClose,
  onSubmit,
}: {
  task: Task;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CancelTaskInput) => void;
}) {
  const t = useTranslations("TaskActions");
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cancelTitle")}</DialogTitle>
          <DialogDescription>{t("cancelDescription", { title: task.title })}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ reason });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cancel-task-reason">{t("fields.reason")}</Label>
            <Textarea
              id="cancel-task-reason"
              rows={3}
              maxLength={5000}
              placeholder={t("fields.reasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t("keepTask")}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {t("confirmCancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
