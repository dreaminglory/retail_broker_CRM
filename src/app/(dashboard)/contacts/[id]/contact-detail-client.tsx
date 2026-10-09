"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactForm } from "@/components/domain/contacts/contact-form";
import type { Contact } from "@/domain/contacts/types";
import {
  updateContactAction,
  archiveContactAction,
} from "@/app/(dashboard)/contacts/actions";
import { Pencil, Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { MergeDialog } from "@/components/domain/contacts/merge-dialog";

interface ContactDetailClientProps {
  contact: Contact;
  agencyId: string;
}

export function ContactDetailClient({ contact }: ContactDetailClientProps) {
  const t = useTranslations("ContactDetailClient");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const boundUpdateAction = updateContactAction.bind(null, contact.id);

  async function handleArchive() {
    setArchiving(true);
    try {
      await archiveContactAction(contact.id);
      setArchiveOpen(false);
      router.push("/contacts");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <MergeDialog currentContact={contact} />
      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              {t("editBtn")}
            </Button>
          }
        />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          <ContactForm
            key={contact.updated_at}
            contact={contact}
            createAction={
              boundUpdateAction as Parameters<typeof ContactForm>[0]["createAction"]
            }
            updateAction={boundUpdateAction}
            onSuccess={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      {contact.status === "active" && (
        <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-muted-foreground"
              >
                <Archive className="h-3.5 w-3.5" />
                {t("archiveBtn")}
              </Button>
            }
          />
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("archiveTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t.rich("archiveDescription", { name: contact.display_name, nameTag: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setArchiveOpen(false)}
              >
                {t("cancelBtn")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? "Archiving…" : "Archive"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
