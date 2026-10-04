"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Merge } from "lucide-react";
import type { Contact } from "@/domain/contacts/types";
import type { MergePreview } from "@/domain/contacts/merge-types";
import {
  searchContactsForMergeAction,
  getMergePreviewAction,
  mergeContactsAction,
} from "@/app/(dashboard)/contacts/merge-actions";

interface MergeDialogProps {
  currentContact: Contact;
}

export function MergeDialog({ currentContact }: MergeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [selectedWinner, setSelectedWinner] = useState<Contact | null>(null);

  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setTimeout(() => setSearchResults([]), 0);
      return;
    }

    const handler = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchContactsForMergeAction(search, currentContact.id);
        setSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [search, currentContact.id]);

  async function handleSelectWinner(winner: Contact) {
    setSelectedWinner(winner);
    setLoadingPreview(true);
    try {
      const p = await getMergePreviewAction(winner.id, currentContact.id);
      setPreview(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleMerge() {
    if (!selectedWinner || !preview) return;

    setMerging(true);
    try {
      await mergeContactsAction(selectedWinner.id, currentContact.id);
      setOpen(false);
      router.push(`/contacts/${selectedWinner.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setMerging(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state
      setSearch("");
      setSearchResults([]);
      setSelectedWinner(null);
      setPreview(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" />}
      >
        <Merge className="h-3.5 w-3.5" />
        Merge
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge Contact</DialogTitle>
          <DialogDescription>
            Merge <strong>{currentContact.display_name}</strong> into another contact. This contact will be archived.
          </DialogDescription>
        </DialogHeader>

        {!selectedWinner ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="search" className="sr-only">Search contacts</Label>
                <Input
                  id="search"
                  placeholder="Type a name to search (e.g. Dimitar Dimitrov)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="rounded-md border divide-y">
                {searchResults.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium">{contact.display_name}</p>
                      {contact.company_name && (
                        <p className="text-muted-foreground">{contact.company_name}</p>
                      )}
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleSelectWinner(contact)}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {search && searchResults.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">No other contacts found.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {loadingPreview ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading preview...</p>
            ) : preview ? (
              <div className="space-y-4">
                <div className="rounded-md border p-4 bg-muted/30">
                  <h4 className="font-medium mb-2 text-sm">Merge Preview</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                    <li>{preview.opportunitiesToTransfer} opportunities will be transferred</li>
                    <li>{preview.inquiriesToTransfer} inquiries will be transferred</li>
                    <li>{preview.tasksToTransfer} tasks will be transferred</li>
                    <li>{preview.contactMethodsToTransfer} unique contact methods will be transferred</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedWinner(null);
                      setPreview(null);
                    }}
                    disabled={merging}
                  >
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleMerge}
                    disabled={merging}
                  >
                    {merging ? "Merging..." : `Merge into ${selectedWinner.display_name}`}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
