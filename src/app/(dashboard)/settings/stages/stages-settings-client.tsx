'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from "next-intl";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStageTranslation } from "@/lib/i18n/use-stage-translation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Stage } from '@/domain/stages/types';
import {
  createStageAction,
  updateStageAction,
  deleteStageAction,
  reorderStagesAction,
} from './actions';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trophy,
  XCircle,
  Leaf,
  Layers,
  AlertTriangle, Archive,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TERMINAL_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  won: { label: 'Won', variant: 'default' },
  lost: { label: 'Lost', variant: 'destructive' },
  nurture: { label: 'Nurture', variant: 'secondary' },
};

function TerminalBadge({ terminalType }: { terminalType: string | null }) {
  if (!terminalType) return null;
  const config = TERMINAL_LABELS[terminalType];
  if (!config) return null;
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

function TerminalIcon({ terminalType }: { terminalType: string | null }) {
  if (terminalType === 'won') return <Trophy className="h-3.5 w-3.5 text-amber-500" />;
  if (terminalType === 'lost') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (terminalType === 'nurture') return <Leaf className="h-3.5 w-3.5 text-emerald-500" />;
  return <Layers className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ── Add / Edit Form ───────────────────────────────────────────────────────────

interface StageFormProps {
  stage?: Stage;
  onSuccess: () => void;
  onCancel: () => void;
}

function StageForm({ stage, onSuccess, onCancel }: StageFormProps) {
  const t = useTranslations("SettingsStages");
  const isEdit = !!stage;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [name, setName] = useState(stage?.name ?? '');
  const [isTerminal, setIsTerminal] = useState(stage?.is_terminal ?? false);
  const [terminalType, setTerminalType] = useState<string>(stage?.terminal_type ?? '');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData();
    formData.set('name', name);
    formData.set('is_terminal', String(isTerminal));
    if (isTerminal && terminalType) {
      formData.set('terminal_type', terminalType);
    }

    startTransition(async () => {
      const prevState = { success: false as const, error: '' };
      const result = isEdit
        ? await updateStageAction(stage.id, prevState, formData)
        : await createStageAction(prevState, formData);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
        if ('fieldErrors' in result && result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="stage-name">{t("stageName")}</Label>
        <Input
          id="stage-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("stageNamePlaceholder")}
          maxLength={100}
          required
          disabled={isPending}
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Terminal toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            id="stage-terminal"
            type="checkbox"
            checked={isTerminal}
            onChange={(e) => {
              setIsTerminal(e.target.checked);
              if (!e.target.checked) setTerminalType('');
            }}
            disabled={isPending}
            className="h-4 w-4 rounded border accent-primary"
          />
          <Label htmlFor="stage-terminal" className="cursor-pointer">
            {t("isTerminal")}
          </Label>
        </div>

        {isTerminal && (
          <div className="space-y-1.5 pl-6">
            <Label htmlFor="stage-terminal-type">{t("terminalType")}</Label>
            <Select
              value={terminalType}
              onValueChange={(v) => setTerminalType(v as string ?? '')}
              disabled={isPending}
            >
              <SelectTrigger id="stage-terminal-type" className="w-48">
                <SelectValue placeholder={t("selectType")}>
                  {(val: string) => {
                    if (val === "won") return <span className="flex items-center gap-2"><Trophy className="h-3.5 w-3.5 text-amber-500" /> {t("terminal.won")}</span>;
                    if (val === "lost") return <span className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 text-destructive" /> {t("terminal.lost")}</span>;
                    if (val === "nurture") return <span className="flex items-center gap-2"><Archive className="h-3.5 w-3.5 text-muted-foreground" /> {t("terminal.nurture")}</span>;
                    return t("selectType");
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="won">
                  <span className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" /> {t("terminal.won")}
                  </span>
                </SelectItem>
                <SelectItem value="lost">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-destructive" /> {t("terminal.lost")}
                  </span>
                </SelectItem>
                <SelectItem value="nurture">
                  <span className="flex items-center gap-2">
                    <Leaf className="h-3.5 w-3.5 text-emerald-500" /> {t("terminal.nurture")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.terminal_type && (
              <p className="text-xs text-destructive">{fieldErrors.terminal_type[0]}</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? t("saving") : isEdit ? t("saveChanges") : t("addStage")}
        </Button>
      </div>
    </form>
  );
}

// ── Delete Confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  stage: Stage;
  oppCount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ stage, oppCount, onSuccess, onCancel }: DeleteConfirmProps) {
  const t = useTranslations("SettingsStages");
  const getStageName = useStageTranslation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blocked = oppCount > 0;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteStageAction(stage.id);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {blocked ? (
        <div className="flex items-start gap-3 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("cannotDelete")}</p>
            <p className="mt-0.5">
              {oppCount === 1 ? t("opportunitiesInStage_1", { count: oppCount }) : t("opportunitiesInStage", { count: oppCount })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t.rich("deleteConfirm", { name: getStageName(stage.name), strong: (c) => <strong>{c}</strong> })}
        </p>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          {t("cancel")}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={blocked || isPending}
        >
          {isPending ? t("deleting") : t("deleteStage")}
        </Button>
      </div>
    </div>
  );
}

// ── Stage Row ─────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: Stage;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMutationSuccess: () => void;
}

function StageRow({ stage, index, total, onMoveUp, onMoveDown, onMutationSuccess }: StageRowProps) {
  const t = useTranslations("SettingsStages");
  const getStageName = useStageTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [oppCount] = useState(0); // let the action validate; shown as 0 for simplicity

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.1)' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${isDragging ? 'bg-background opacity-90' : 'bg-transparent'}`}
    >
      {/* Drag handle / reorder arrows */}
      <div className="flex shrink-0 flex-col items-center gap-0.5 text-muted-foreground">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-0.5 hover:bg-muted disabled:opacity-20"
          aria-label={t("moveUp")}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:bg-muted p-1 rounded active:cursor-grabbing"
          aria-label={t("dragToReorder")}
        >
          <GripVertical className="h-4 w-4 opacity-30 group-hover:opacity-60" />
        </div>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded p-0.5 hover:bg-muted disabled:opacity-20"
          aria-label={t("moveDown")}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stage info */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <TerminalIcon terminalType={stage.terminal_type} />
        <span className="truncate text-sm font-medium">{getStageName(stage.name)}</span>
        <TerminalBadge terminalType={stage.terminal_type} />
        {!stage.is_terminal && (
          <Badge variant="outline" className="text-xs">{t("activeBadge")}</Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Edit */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger
            render={
              <Button variant="ghost" size="sm" aria-label={t("editName", { name: getStageName(stage.name) })}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("editStage")}</DialogTitle>
            </DialogHeader>
            <StageForm
              stage={stage}
              onSuccess={() => {
                setEditOpen(false);
                onMutationSuccess();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Delete */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("deleteName", { name: getStageName(stage.name) })}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("deleteStage")}</DialogTitle>
            </DialogHeader>
            <DeleteConfirm
              stage={stage}
              oppCount={oppCount}
              onSuccess={() => {
                setDeleteOpen(false);
                onMutationSuccess();
              }}
              onCancel={() => setDeleteOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

interface StagesSettingsClientProps {
  initialStages: Stage[];
}

export function StagesSettingsClient({ initialStages }: StagesSettingsClientProps) {
  const t = useTranslations("SettingsStages");
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [isSavingOrder, startOrderTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a small 5px drag to initiate, allows clicking on buttons inside
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setTimeout(() => setStages(initialStages), 0);
  }, [initialStages]);

  const handleMutationSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  function persistReorder(newStages: Stage[]) {
    // Re-assign sort_order as 0-based indexes for persistence
    const reordered = newStages.map((s, i) => ({ ...s, sort_order: i }));
    setStages(reordered);

    startOrderTransition(async () => {
      await reorderStagesAction(
        reordered.map((s) => ({ id: s.id, sort_order: s.sort_order }))
      );
    });
  }

  // Click-based move
  function move(index: number, direction: 'up' | 'down', listType: 'pipeline' | 'terminal') {
    const list = listType === 'pipeline' ? pipeline : terminal;
    const globalIndex = stages.findIndex(s => s.id === list[index].id);
    
    const swapTargetIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapTargetIndex < 0 || swapTargetIndex >= list.length) return;
    
    const globalSwapIndex = stages.findIndex(s => s.id === list[swapTargetIndex].id);

    const next = [...stages];
    [next[globalIndex], next[globalSwapIndex]] = [next[globalSwapIndex], next[globalIndex]];
    persistReorder(next);
  }

  // Drag and drop event handler
  function handleDragEnd(event: DragEndEvent, listType: 'pipeline' | 'terminal') {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        // Safety check to ensure they are dragging within the same list type
        if (items[oldIndex].is_terminal !== items[newIndex].is_terminal) {
          return items; 
        }

        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Defer persistence to avoid blocking UI render
        setTimeout(() => persistReorder(newItems), 0);
        
        return newItems;
      });
    }
  }

  const pipeline = stages.filter((s) => !s.is_terminal);
  const terminal = stages.filter((s) => s.is_terminal);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {stages.length === 1 ? t("stagesTotal_1", { count: stages.length }) : t("stagesTotal", { count: stages.length })}
          {isSavingOrder && (
            <span className="ml-2 text-xs text-muted-foreground/70">{t("savingOrder")}</span>
          )}
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("addStage")}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("addPipelineStage")}</DialogTitle>
            </DialogHeader>
            <StageForm
              onSuccess={() => {
                setAddOpen(false);
                handleMutationSuccess();
              }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline stages */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("pipelineStages", { count: pipeline.length })}
        </h2>
        {pipeline.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("noPipelineStages")}
          </p>
        ) : (
          <DndContext 
            id="pipeline-stages-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(e, 'pipeline')}
          >
            <div className="divide-y rounded-lg border bg-card">
              <SortableContext 
                items={pipeline.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {pipeline.map((stage, i) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    index={i}
                    total={pipeline.length}
                    onMoveUp={() => move(i, 'up', 'pipeline')}
                    onMoveDown={() => move(i, 'down', 'pipeline')}
                    onMutationSuccess={handleMutationSuccess}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </section>

      {/* Terminal stages */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("terminalStagesTitle", { count: terminal.length })}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {t("terminalStagesDesc")}
        </p>
        {terminal.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("noTerminalStages")}
          </p>
        ) : (
          <DndContext 
            id="terminal-stages-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(e, 'terminal')}
          >
            <div className="divide-y rounded-lg border bg-card">
              <SortableContext 
                items={terminal.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {terminal.map((stage, i) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    index={i}
                    total={terminal.length}
                    onMoveUp={() => move(i, 'up', 'terminal')}
                    onMoveDown={() => move(i, 'down', 'terminal')}
                    onMutationSuccess={handleMutationSuccess}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        )}
      </section>
    </div>
  );
}
