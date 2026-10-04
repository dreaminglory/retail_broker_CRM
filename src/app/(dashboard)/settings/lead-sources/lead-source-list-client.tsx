"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LeadSourceForm } from "@/components/domain/lead-sources/lead-source-form";
import type { LeadSource } from "@/domain/lead-sources/types";
import {
  createLeadSourceAction,
  updateLeadSourceAction,
  deactivateLeadSourceAction,
} from "./actions";
import { Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import type { ActionResult } from "@/lib/actions";

const CHANNEL_LABELS: Record<string, string> = {
  portal: "Portal",
  referral: "Referral",
  website: "Website",
  phone: "Phone",
  social: "Social",
  email: "Email",
  walk_in: "Walk-in",
  other: "Other",
};

interface LeadSourceListClientProps {
  leadSources: LeadSource[];
}

export function LeadSourceListClient({ leadSources }: LeadSourceListClientProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editSource, setEditSource] = useState<LeadSource | null>(null);

  const active = leadSources.filter((s) => s.is_active);
  const inactive = leadSources.filter((s) => !s.is_active);

  return (
    <div className="space-y-6">
      {/* Add new */}
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add lead source
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add lead source</DialogTitle>
            </DialogHeader>
            <LeadSourceForm
              createAction={createLeadSourceAction}
              onSuccess={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Active sources */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No active lead sources yet. Add one above.
          </p>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {active.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                onEdit={() => setEditSource(source)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inactive sources */}
      {inactive.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Inactive ({inactive.length})
          </h2>
          <div className="divide-y rounded-lg border bg-card opacity-60">
            {inactive.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                onEdit={() => setEditSource(source)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editSource} onOpenChange={(o) => !o && setEditSource(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit lead source</DialogTitle>
          </DialogHeader>
          {editSource && (
            <LeadSourceForm
              leadSource={editSource}
              createAction={createLeadSourceAction}
              updateAction={updateLeadSourceAction.bind(null, editSource.id)}
              onSuccess={() => setEditSource(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceRow({
  source,
  onEdit,
}: {
  source: LeadSource;
  onEdit: () => void;
}) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await deactivateLeadSourceAction(source.id);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-medium">{source.name}</p>
          <p className="text-xs text-muted-foreground">
            {CHANNEL_LABELS[source.channel] ?? source.channel}
          </p>
        </div>
        {!source.is_active && (
          <Badge variant="secondary" className="text-xs">
            Inactive
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit ${source.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {source.is_active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            disabled={toggling}
            aria-label={`Deactivate ${source.name}`}
            title="Deactivate"
          >
            <ToggleRight className="h-4 w-4 text-primary" />
          </Button>
        )}
        {!source.is_active && <ReactivateButton source={source} />}
      </div>
    </div>
  );
}

function ReactivateButton({ source }: { source: LeadSource }) {
  const [pending, setPending] = useState(false);

  async function handleReactivate() {
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("is_active", "true");
      const prevState: ActionResult = { success: false, error: "" };
      await updateLeadSourceAction(source.id, prevState, formData);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReactivate}
      disabled={pending}
      aria-label={`Reactivate ${source.name}`}
      title="Reactivate"
    >
      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}
