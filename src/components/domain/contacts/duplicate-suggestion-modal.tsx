'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Mail, Phone } from 'lucide-react';
import type { PotentialDuplicate } from '@/domain/contacts/duplicate-detection';
import { useTranslations } from "next-intl";
import Link from 'next/link';

interface DuplicateSuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: PotentialDuplicate[];
  onProceedAnyway: () => void;
  isSubmitting?: boolean;
}

export function DuplicateSuggestionModal({
  open,
  onOpenChange,
  duplicates,
  onProceedAnyway,
  isSubmitting = false,
}: DuplicateSuggestionModalProps) {
  const t = useTranslations("DuplicateSuggestionModal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { count: duplicates.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {duplicates.map((dup) => (
            <Card key={dup.contact.id} className="border-border">
              <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-lg">{dup.contact.display_name}</h4>
                    {dup.contact.type === 'organization' && (
                      <Badge variant="secondary">{t("organization")}</Badge>
                    )}
                  </div>

                  {/* Match reasons */}
                  <div className="flex flex-wrap gap-2">
                    {dup.match_reasons.includes('phone') && (
                      <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">
                        {t("matches.phone")}
                      </Badge>
                    )}
                    {dup.match_reasons.includes('email') && (
                      <Badge variant="outline" className="text-purple-600 bg-purple-50 border-purple-200">
                        {t("matches.email")}
                      </Badge>
                    )}
                    {dup.match_reasons.includes('name') && (
                      <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                        {t("matches.name")}
                      </Badge>
                    )}
                  </div>

                  {/* Contact Methods */}
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {dup.contact_methods.filter(m => m.type === 'phone' || m.type === 'viber' || m.type === 'whatsapp').map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        <span>{m.value}</span>
                      </div>
                    ))}
                    {dup.contact_methods.filter(m => m.type === 'email').map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        <span>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <Button variant="secondary" render={<Link href={`/contacts/${dup.contact.id}`} />} nativeButton={false}>
                    {t("viewProfile")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="sm:justify-center !m-0 !p-0 !border-0 !bg-transparent mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button variant="destructive" onClick={onProceedAnyway} disabled={isSubmitting}>
            {isSubmitting ? t("actions.creating") : t("actions.createAnyway")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
