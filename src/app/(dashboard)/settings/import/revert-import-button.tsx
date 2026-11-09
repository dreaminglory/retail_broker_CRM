"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Undo2 } from "lucide-react";
import { revertImportJobAction } from "./actions";
import { toast } from "sonner";
import { revertSummary } from "@/domain/imports/revert-summary";
import type { ImportEntityType } from "@/domain/imports/types";

interface RevertImportButtonProps {
  jobId: string;
  fileName: string;
  entityType: ImportEntityType;
}

import { useTranslations } from "next-intl";

export function RevertImportButton({ jobId, fileName, entityType }: RevertImportButtonProps) {
  const t = useTranslations("SettingsImport");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRevert = () => {
    startTransition(async () => {
      try {
        const result = await revertImportJobAction(jobId);
        if (result.success) {
          const summary = revertSummary(entityType, result.data);
          toast.success(
            summary.key === "revertSuccessProperty"
              ? t("revertSuccessProperty", summary.values)
              : t("revertSuccess", summary.values)
          );
          setOpen(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(t("revertFailed"));
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t("revertImport")} />
      }>
        <Undo2 className="h-4 w-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("revertImport")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich("revertConfirm", { fileName, strong: (c) => <strong>{c}</strong> })}{" "}
            {entityType === "property" ? t("revertDescProperty") : t("revertDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleRevert();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? t("reverting") : t("revert")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
