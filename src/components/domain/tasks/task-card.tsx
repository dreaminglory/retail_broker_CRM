"use client";
import { useFormatter, useNow, useTranslations } from "next-intl";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  Eye,
  Users,
  CalendarCheck,
  MoreHorizontal,
  Clock,
  AlertTriangle,
  CheckCircle,
  Briefcase,
} from "lucide-react";
import type { Task, TaskType } from "@/domain/tasks/types";
import { todayBucket } from "@/lib/time/agency-day";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  /** The agency's timezone: "today" and the times shown are agency time. */
  timeZone: string;
  opportunityTitle?: string;
  /** Shown under the title, e.g. on Today's agency scope. */
  assigneeName?: string;
  onComplete: (taskId: string) => void;
  showOpportunity?: boolean;
  /** The task menu (edit, reschedule, cancel). */
  menu?: React.ReactNode;
}

const TASK_TYPE_CONFIG: Record<TaskType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  call: { icon: Phone, label: "Call", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  email: { icon: Mail, label: "Email", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  viewing: { icon: Eye, label: "Viewing", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  meeting: { icon: Users, label: "Meeting", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  follow_up: { icon: CalendarCheck, label: "Follow-up", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  other: { icon: MoreHorizontal, label: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

export function TaskCard({
  task,
  timeZone,
  opportunityTitle,
  assigneeName,
  onComplete,
  showOpportunity = true,
  menu,
}: TaskCardProps) {
  const t = useTranslations('TaskCard');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const bucket = task.due_at ? todayBucket(task.due_at, timeZone, now) : null;
  const isOverdue = bucket === "overdue" && task.status === "pending";
  const isDueToday = bucket === "dueToday";
  const typeConfig = task.task_type ? TASK_TYPE_CONFIG[task.task_type] : null;
  const TypeIcon = typeConfig?.icon ?? CalendarCheck;

  const resolvedOppTitle = opportunityTitle || ("opportunity_title" in task ? (task as unknown as Record<string, string>).opportunity_title : undefined);
  const resolvedAssignee =
    assigneeName ?? ("assignee_name" in task ? (task as unknown as Record<string, string>).assignee_name : undefined);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3.5 transition-all hover:shadow-sm",
        isOverdue && "border-destructive/40 bg-destructive/5",
        isDueToday && !isOverdue && "border-amber-300/50 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-900/10",
        !isOverdue && !isDueToday && "bg-card"
      )}
    >
      {/* Type icon */}
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          typeConfig?.color ?? "bg-muted text-muted-foreground"
        )}
      >
        <TypeIcon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm leading-snug truncate">{task.title}</p>
            {showOpportunity && resolvedOppTitle && (
              task.opportunity_id ? (
                <Link 
                  href={`/opportunities/${task.opportunity_id}`}
                  className="text-xs text-muted-foreground hover:text-primary mt-0.5 truncate flex items-center gap-1.5 transition-colors"
                >
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {resolvedOppTitle}
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {resolvedOppTitle}
                </p>
              )
            )}
            {resolvedAssignee && (
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                <Users className="h-3 w-3" />
                {resolvedAssignee}
              </p>
            )}
          </div>

          {/* Task type badge */}
          {typeConfig && (
            <Badge variant="secondary" className={cn("text-[10px] shrink-0", typeConfig.color)}>
              {typeConfig ? t('types.' + task.task_type) : ''}
            </Badge>
          )}
        </div>

        {/* Due date + overdue indicator */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            {isOverdue ? (
              <>
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="font-medium text-destructive">
                  {t('overdueSince', { relative: format.relativeTime(new Date(task.due_at!), now) })}
                </span>
              </>
            ) : task.due_at ? (
              <>
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isDueToday
                    ? t('dueTodayTime', {
                        time: format.dateTime(new Date(task.due_at), { hour: '2-digit', minute: '2-digit', timeZone }),
                      })
                    : t('dueDateTime', {
                        date: format.dateTime(new Date(task.due_at), {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone,
                        }),
                      })}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground italic">{t("noDueDate")}</span>
            )}
          </div>

          {task.status === "pending" && (
            <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task.id);
              }}
            >
              <CheckCircle className="mr-1 h-3.5 w-3.5" />
              {t("complete")}</Button>
            {menu}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { TASK_TYPE_CONFIG };
