"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookmarkPlus, Save, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveListAction, updateListFilterAction } from "@/app/(dashboard)/lists/actions";
import type { SmartListEntity } from "@/domain/smart-lists/types";

/** The URL params that are filters: not the page, not the list being edited. */
function filterParams(searchParams: URLSearchParams): Record<string, string> {
  const params = Object.fromEntries(searchParams);
  delete params.page;
  delete params.list;
  return params;
}

type SaveListDialogProps = {
  entity: SmartListEntity;
};

/** "Save as list": stores the list's current URL filters under a name (rule 3). */
export function SaveListDialog({ entity }: SaveListDialogProps) {
  const t = useTranslations("smartLists.saved");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setName("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveListAction({ name, entity, params: filterParams(searchParams) });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("savedToast"));
      router.push(`/lists/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" type="button">
            <BookmarkPlus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("saveAsList")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("saveTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smart-list-name">{t("nameLabel")}</Label>
            <Input
              id="smart-list-name"
              value={name}
              maxLength={60}
              required
              autoFocus
              placeholder={t("namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("saveHint")}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type UpdateListBarProps = {
  /** `shownExactly` false: the page can't show the saved filter as it is, so Update changes it. */
  list: { id: string; name: string; shownExactly: boolean };
};

/** Shown on the entity list opened from "Edit filters": saves the filters shown into the list. */
export function UpdateListBar({ list }: UpdateListBarProps) {
  const t = useTranslations("smartLists.saved");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update() {
    startTransition(async () => {
      const result = await updateListFilterAction({ id: list.id, params: filterParams(searchParams) });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("updatedToast"));
      router.push(`/lists/${list.id}`);
    });
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <div className="min-w-0 space-y-1">
        <p className="break-words text-sm">{t("editing", { name: list.name })}</p>
        {!list.shownExactly && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("notShownExactly")}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/lists/${list.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("cancel")}
        </Link>
        <Button size="sm" type="button" disabled={pending} onClick={update}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          {t("updateList")}
        </Button>
      </div>
    </div>
  );
}
