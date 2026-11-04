"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AreaForm } from "@/components/domain/areas/area-form";
import { SettlementCombobox } from "@/components/domain/settlements/settlement-combobox";
import type { Area, SettlementAreaCount } from "@/domain/areas/types";
import type { Settlement } from "@/domain/settlements/types";
import { cn } from "@/lib/utils";
import { createAreaAction, reorderAreasAction, updateAreaAction } from "./actions";

type AreasSettingsClientProps = {
  settlement: Settlement | null;
  settlementsWithAreas: SettlementAreaCount[];
  areas: Area[];
};

export function AreasSettingsClient({ settlement, settlementsWithAreas, areas }: AreasSettingsClientProps) {
  const t = useTranslations("SettingsAreas");
  const router = useRouter();
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [pending, startTransition] = useTransition();

  function pickSettlement(next: Settlement | null) {
    if (next && next.id !== settlement?.id) router.push(`/settings/areas?settlement=${next.id}`);
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.success && result.error) toast.error(result.error);
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= areas.length) return;
    const ordered = [...areas];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    run(() => reorderAreasAction(ordered.map((area, i) => ({ id: area.id, sort_order: i }))));
  }

  function setActive(area: Area, isActive: boolean) {
    const formData = new FormData();
    formData.set("is_active", String(isActive));
    run(() => updateAreaAction(area.id, { success: true, data: undefined }, formData));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="areas-settlement">{t("settlement")}</Label>
        <SettlementCombobox id="areas-settlement" defaultValue={settlement} onChange={pickSettlement} />
        {settlementsWithAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2" aria-label={t("withAreas")}>
            {settlementsWithAreas.map(({ settlement: s, count }) => (
              <Link
                key={s.id}
                href={`/settings/areas?settlement=${s.id}`}
                aria-current={s.id === settlement?.id ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent",
                  s.id === settlement?.id ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"
                )}
              >
                {t("settlementChip", { name: s.name, count })}
              </Link>
            ))}
          </div>
        )}
      </div>

      {!settlement ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("pickSettlement")}
        </p>
      ) : (
        <section className="space-y-4" aria-labelledby="areas-heading">
          <div>
            <h2 id="areas-heading" className="text-lg font-semibold">
              {t("areasIn", { name: settlement.name })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("location", { municipality: settlement.municipality, province: settlement.province })}
            </p>
          </div>

          <AreaForm settlementId={settlement.id} action={createAreaAction} />

          {areas.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {areas.map((area, index) => (
                <li key={area.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate text-sm font-medium", !area.is_active && "text-muted-foreground")}>
                      {area.name}
                    </span>
                    {!area.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        {t("inactiveBadge")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={t("moveUp", { name: area.name })}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || index === areas.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={t("moveDown", { name: area.name })}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditArea(area)}
                      aria-label={t("rename", { name: area.name })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setActive(area, !area.is_active)}
                      aria-label={t(area.is_active ? "deactivate" : "reactivate", { name: area.name })}
                      title={t(area.is_active ? "deactivate" : "reactivate", { name: area.name })}
                    >
                      {area.is_active ? (
                        <ToggleRight className="h-4 w-4 text-primary" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Dialog open={!!editArea} onOpenChange={(open) => !open && setEditArea(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </DialogHeader>
          {editArea && settlement && (
            <AreaForm
              settlementId={settlement.id}
              area={editArea}
              action={updateAreaAction.bind(null, editArea.id)}
              onSuccess={() => setEditArea(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
