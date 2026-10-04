"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { OpportunityParticipant } from "@/domain/opportunities/types";
import type { Contact } from "@/domain/contacts/types";
import type { ActionResult } from "@/lib/actions";
import { Plus, User, Building2, X, Users2 } from "lucide-react";

interface ParticipantListProps {
  opportunityId: string;
  participants: OpportunityParticipant[];
  contacts: Contact[];
  addAction: (
    opportunityId: string,
    prevState: ActionResult,
    formData: FormData
  ) => Promise<ActionResult<{ id: string }>>;
  removeAction: (id: string, opportunityId: string) => Promise<ActionResult>;
}

const ROLE_OPTIONS = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "co_owner", label: "Co-owner" },
  { value: "representative", label: "Representative" },
  { value: "broker", label: "Broker" },
  { value: "other", label: "Other" },
];

const initialState: ActionResult<{ id: string }> = { success: false, error: "" };

export function ParticipantList({
  opportunityId,
  participants,
  contacts,
  addAction,
  removeAction,
}: ParticipantListProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const [state, formAction, pending] = useActionState(
    addAction.bind(null, opportunityId) as (
      prevState: ActionResult<{ id: string }>,
      formData: FormData
    ) => Promise<ActionResult<{ id: string }>>,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      setTimeout(() => {
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      }, 0);
    }
  }, [state.success, router]);

  function handleRemove(participantId: string) {
    setParticipantToRemove(participantId);
  }

  async function confirmRemove() {
    if (!participantToRemove) return;
    setIsRemoving(true);
    try {
      await removeAction(participantToRemove, opportunityId);
      setParticipantToRemove(null);
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  const fieldErrors = !state.success ? state.fieldErrors : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users2 className="h-4 w-4 text-muted-foreground" />
          Participants ({participants.length})
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="h-8">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Participant</DialogTitle>
            </DialogHeader>
            <form ref={formRef} action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="contact_id">
                  Contact <span className="text-destructive">*</span>
                </Label>
                <Select name="contact_id" required>
                  <SelectTrigger id="contact_id">
                    <SelectValue placeholder="Select contact">
                      {(val) => contacts.find((c) => c.id === val)?.display_name ?? "Select contact"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors?.contact_id && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.contact_id[0]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select name="role" defaultValue="buyer" required>
                  <SelectTrigger id="role">
                    <SelectValue>
                      {(val) => ROLE_OPTIONS.find((o) => o.value === val)?.label ?? "Select role"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors?.role && (
                  <p className="text-xs text-destructive">{fieldErrors.role[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  maxLength={1000}
                  placeholder="e.g. Needs financing, representing the buyer..."
                  rows={2}
                />
              </div>

              {!state.success && state.error && !state.fieldErrors && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Adding…" : "Add participant"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border divide-y bg-card">
        {participants.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No participants added.
          </div>
        ) : (
          participants.map((p) => {
            const contact = contacts.find((c) => c.id === p.contact_id);
            const isPerson = contact?.type === "person";

            return (
              <div
                key={p.id}
                className="flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {isPerson ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {contact?.display_name || "Internal User"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ROLE_OPTIONS.find((o) => o.value === p.role)?.label ||
                        p.role}
                      {p.notes ? ` • ${p.notes}` : ""}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(p.id)}
                  title="Remove participant"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {/* Remove confirmation dialog */}
      <Dialog 
        open={!!participantToRemove} 
        onOpenChange={(open: boolean) => !open && setParticipantToRemove(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove participant</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove this participant from the opportunity?
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setParticipantToRemove(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
