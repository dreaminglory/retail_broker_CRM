"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteListAction, renameListAction } from "@/app/(dashboard)/lists/actions";

type SavedListControlsProps = {
  listId: string;
  name: string;
  /** The entity list with this list's filters and "Update list". */
  editHref: string;
};

/** Rename, Edit filters and Delete on a saved list the viewer may change (rule 4). */
export function SavedListControls({ listId, name, editHref }: SavedListControlsProps) {
  const t = useTranslations("smartLists.saved");
  const router = useRouter();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [newName, setNewName] = useState(name);
  const [pending, startTransition] = useTransition();

  function openRename() {
    setNewName(name);
    setDialog("rename");
  }

  function rename(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await renameListAction({ id: listId, name: newName });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDialog(null);
      toast.success(t("renamedToast"));
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteListAction({ id: listId });
      setDialog(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("deletedToast"));
      router.push("/lists");
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" type="button" onClick={openRename}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {t("rename")}
      </Button>
      <Link href={editHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {t("editFilters")}
      </Link>
      <Button size="sm" variant="ghost" type="button" className="text-destructive" onClick={() => setDialog("delete")}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {t("delete")}
      </Button>

      <Dialog open={dialog === "rename"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={rename} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smart-list-rename">{t("nameLabel")}</Label>
              <Input
                id="smart-list-rename"
                value={newName}
                maxLength={60}
                required
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || newName.trim() === ""}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
