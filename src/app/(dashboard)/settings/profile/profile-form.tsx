'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from './actions';
import { toast } from 'sonner';

interface ProfileFormProps {
  currentDisplayName: string;
}

import { useTranslations } from "next-intl";

export function ProfileForm({ currentDisplayName }: ProfileFormProps) {
  const t = useTranslations("SettingsProfile");
  const router = useRouter();
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = displayName.trim() !== currentDisplayName;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set('display_name', displayName);

    try {
      const result = await updateProfile(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("success"));
        router.refresh();
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">{t("displayName")}</Label>
        <Input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("displayNamePlaceholder")}
          minLength={2}
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t("displayNameHelp")}
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? t("saving") : t("saveChanges")}
        </Button>
      </div>
    </form>
  );
}
