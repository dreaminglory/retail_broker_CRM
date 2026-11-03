"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { deletePropertyAction, setPropertyArchivedAction } from "@/app/(dashboard)/properties/actions";
import type { PropertyStatus } from "@/domain/properties/types";

type PropertyActionsMenuProps = {
  propertyId: string;
  status: PropertyStatus;
  /** Delete is owner/manager only (T2). */
  canDelete: boolean;
};

export function PropertyActionsMenu({ propertyId, status, canDelete }: PropertyActionsMenuProps) {
  const t = useTranslations("PropertyActions");
  const router = useRouter();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const archived = status === "archived";

  function setArchived(next: boolean) {
    startTransition(async () => {
      const result = await setPropertyArchivedAction(propertyId, next);
      if (result.success) toast.success(t(next ? "archivedToast" : "unarchivedToast"));
      else toast.error(result.error);
      setConfirm(null);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePropertyAction(propertyId);
      setConfirm(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(t("deletedToast"));
      router.push("/properties");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/properties/${propertyId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        {t("edit")}
      </Link>
      {archived ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setArchived(false)}>
          <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
          {t("unarchive")}
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm("archive")}>
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          {t("archive")}
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => setConfirm("delete")}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {t("delete")}
        </Button>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm && t(`${confirm}Title`)}</AlertDialogTitle>
            <AlertDialogDescription>{confirm && t(`${confirm}Description`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "delete" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => (confirm === "delete" ? remove() : setArchived(true))}
            >
              {confirm && t(confirm)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
