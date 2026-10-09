'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateLocaleAction } from './actions';
import { toast } from 'sonner';

interface LanguageSwitcherProps {
  currentLocale: string;
  }

import { useTranslations } from "next-intl";

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const t = useTranslations("SettingsProfile");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onChange(locale: string | null) {
    if (!locale) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      const res = await updateLocaleAction(formData);
      if (res.success) {
        toast.success(t("langSuccess"));
        router.refresh();
      } else {
        toast.error(t("langError"));
      }
    });
  }

  
  return (
    <div className="space-y-2 mt-6">
      <Label htmlFor="locale">{t("language")}</Label>
      <Select
        value={currentLocale}
        onValueChange={(locale) => onChange(locale as string | null)}
        disabled={isPending}
      >
        <SelectTrigger id="locale">
          <SelectValue placeholder={t("selectLanguage")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="bg">Български</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {t("languageHelp")}
      </p>
    </div>
  );
}
