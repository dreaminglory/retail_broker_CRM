"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { findCallTaskAction, logCallAction } from "@/app/(dashboard)/calls/actions";
import { CALL_CHANNELS, type CallChannel, type CallContext, type CallResult, type CompletableTask } from "@/domain/calls/types";
import { isToday18Available } from "@/domain/tasks/reschedule";
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";
import {
  callContext,
  callDeal,
  canSave,
  chooseResult,
  initialPostCallState,
  nextOptions,
  setOutcome,
  showNoNextWarning,
  toLogCallInput,
  type CallDeal,
  type NextChoice,
  type PostCallState,
} from "./post-call-state";

export type { CallDeal } from "./post-call-state";

/** "No deal" in the deal picker (rule 2). */
const NO_DEAL = "none";

/** Who and what a call is logged against (spec phone-loop rule 2). */
export type PostCallTarget = {
  context: CallContext;
  /** Display name only, never a number (rule 12). */
  name: string;
  /** Set when the prompt follows a tap; absent for "Log call", which shows a channel picker. */
  channel?: CallChannel;
  /** A won, lost or archived deal with no `deal` given (rule 8); a given deal decides by itself. */
  closed?: boolean;
  /** A dismissed inquiry: no retry (rule 8). */
  noRetry?: boolean;
  /** The deal the call is on: stage change, closed defaults (rule 8) and the rule 7 warning. */
  deal?: CallDeal;
  /** A contact's several active deals: the prompt asks which one, "No deal" allowed (rule 2). */
  dealChoices?: CallDeal[];
  /** The agency's stages, for a stage change after an answered call on an active deal. */
  stages?: { id: string; name: string }[];
};

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

type PostCallFormProps = {
  target: PostCallTarget;
  /** The agency's timezone (rule 5). */
  timeZone: string;
  onDone: () => void;
  /** Tests start from a choice; the app always starts with none. */
  initialResult?: CallResult;
};

export function PostCallForm({ target, timeZone, onDone, initialResult }: PostCallFormProps) {
  const t = useTranslations("phoneLoop.sheet");
  const getStageName = useStageTranslation();
  const router = useRouter();
  const ids = useId();
  const [dealId, setDealId] = useState<string | null>(null);
  const deal = callDeal(target, dealId);
  const context = callContext(target, dealId);
  const closed = deal ? !deal.active : !!target.closed;
  const resultOpts = { noAnswerOutcome: t("noAnswerOutcome"), closed, noRetry: !!target.noRetry };

  const [state, setState] = useState<PostCallState>(() => {
    const start = initialPostCallState(target.channel ?? "phone");
    return initialResult ? chooseResult(start, initialResult, resultOpts) : start;
  });
  const [task, setTask] = useState<CompletableTask | null>(null);
  const [completeTask, setCompleteTask] = useState(true);
  const [saving, setSaving] = useState(false);
  // Bumped after a failed save: a save that completed the task but not its retry (AD-065, the
  // complete path isn't atomic) must not offer to complete that task again.
  const [taskCheck, setTaskCheck] = useState(0);

  // Which pending call of mine this would complete ("Completes: <task>", rule 6).
  const contextKey = JSON.stringify(context);
  useEffect(() => {
    let live = true;
    findCallTaskAction(JSON.parse(contextKey) as CallContext, state.channel).then((res) => {
      if (live) setTask(res.success ? res.data : null);
    });
    return () => {
      live = false;
    };
  }, [contextKey, state.channel, taskCheck]);

  const options = state.result
    ? nextOptions(state.result, { today18: isToday18Available(timeZone), noRetry: !!target.noRetry })
    : [];

  async function save() {
    const input = toLogCallInput(state, {
      context,
      name: target.name,
      completeTaskId: task && completeTask ? task.id : null,
      currentStageId: deal?.stageId ?? null,
    });
    if (!input) return;
    setSaving(true);
    const res = await logCallAction(input);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      setTaskCheck((n) => n + 1);
      return;
    }
    toast.success(t("saved"));
    onDone();
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        {/* A name or deal title may be one long word: let it break, never widen the sheet. */}
        <DialogTitle className="pr-6 [overflow-wrap:anywhere]">{t("title", { name: target.name })}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
      </DialogHeader>

      {!!target.dealChoices?.length && (
        <ChoiceRow
          label={t("dealLabel")}
          options={[NO_DEAL, ...target.dealChoices.map((d) => d.id)]}
          value={dealId ?? NO_DEAL}
          render={(id) => (id === NO_DEAL ? t("noDeal") : target.dealChoices!.find((d) => d.id === id)!.title)}
          onChange={(id) => {
            setDealId(id === NO_DEAL ? null : id);
            // The stage belongs to the deal it was picked on.
            setState((s) => ({ ...s, stageId: null }));
          }}
        />
      )}

      {!target.channel && (
        <ChoiceRow
          label={t("channelLabel")}
          options={[...CALL_CHANNELS]}
          value={state.channel}
          render={(c) => t(`channels.${c}`)}
          onChange={(channel) => setState((s) => ({ ...s, channel }))}
        />
      )}

      {state.result && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-outcome`}>
              {t("outcomeLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`${ids}-outcome`}
              value={state.outcome}
              onChange={(e) => setState((s) => setOutcome(s, e.target.value))}
              placeholder={t("outcomePlaceholder")}
              rows={3}
              maxLength={5000}
              required
              autoFocus
            />
          </div>

          <ChoiceRow
            label={state.result === "answered" ? t("nextLabel") : t("retryLabel")}
            options={options}
            value={state.next}
            render={(n) => (n === "none" && state.result === "no_answer" ? t("noRetry") : t(`presets.${n}`))}
            onChange={(next: NextChoice) => setState((s) => ({ ...s, next }))}
          />
          {state.next === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-due`}>{t("customLabel")}</Label>
              <Input
                id={`${ids}-due`}
                type="datetime-local"
                value={state.customDueAt}
                onChange={(e) => setState((s) => ({ ...s, customDueAt: e.target.value }))}
                required
              />
            </div>
          )}

          {state.result === "answered" && deal?.active && !!target.stages?.length && (
            <ChoiceRow
              label={t("stageLabel")}
              options={target.stages.map((s) => s.id)}
              value={state.stageId ?? deal.stageId}
              render={(id) => getStageName(target.stages!.find((s) => s.id === id)?.name ?? "")}
              onChange={(stageId) => setState((s) => ({ ...s, stageId }))}
            />
          )}

          {showNoNextWarning(state, deal, !!task && completeTask) && (
            <p role="status" className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("noNextWarning")}
            </p>
          )}

          {task && (
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <Label htmlFor={`${ids}-complete`} className="min-w-0 flex-1 font-normal">
                <span className="block truncate">{t("completes", { title: task.title })}</span>
              </Label>
              <Switch id={`${ids}-complete`} checked={completeTask} onCheckedChange={setCompleteTask} aria-describedby={`${ids}-complete-hint`} />
              <span id={`${ids}-complete-hint`} className="sr-only">{t("completesHint")}</span>
            </div>
          )}
        </>
      )}

      {/* The three choices sit at the bottom, full width on a phone (spec Screens). */}
      <div className="grid gap-2 sm:grid-cols-3">
        <ResultButton
          active={state.result === "answered"}
          onClick={() => setState((s) => chooseResult(s, "answered", resultOpts))}
          icon={<PhoneOutgoing className="size-4" aria-hidden />}
        >
          {t("answered")}
        </ResultButton>
        <ResultButton
          active={state.result === "no_answer"}
          onClick={() => setState((s) => chooseResult(s, "no_answer", resultOpts))}
          icon={<PhoneMissed className="size-4" aria-hidden />}
        >
          {t("noAnswer")}
        </ResultButton>
        <Button type="button" variant="ghost" className="h-11 sm:h-9" onClick={onDone}>
          {t("notNow")}
        </Button>
      </div>

      {state.result && (
        <Button type="button" className="h-11 w-full sm:h-9" disabled={!canSave(state) || saving} onClick={save}>
          {saving ? t("saving") : t("save")}
        </Button>
      )}
    </div>
  );
}

function ResultButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} aria-pressed={active} className="h-11 sm:h-9" onClick={onClick}>
      {icon}
      {children}
    </Button>
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  render,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  render: (option: T) => string;
  onChange: (option: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-sm font-medium">{label}</p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 max-w-full rounded-full border px-3 text-left text-sm transition-colors [overflow-wrap:anywhere] sm:min-h-8",
              value === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
            )}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
