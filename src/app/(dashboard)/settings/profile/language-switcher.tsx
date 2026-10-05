'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateLocaleAction } from './actions';
import { toast } from 'sonner';

interface LanguageSwitcherProps {
  currentLocale: string;
  bgEnabled: boolean;
}

export function LanguageSwitcher({ currentLocale, bgEnabled }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onChange(locale: string | null) {
    if (!locale) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('locale', locale);
      const res = await updateLocaleAction(formData);
      if (res.success) {
        toast.success('Language updated');
        router.refresh();
      } else {
        toast.error('Failed to update language');
      }
    });
  }

  if (!bgEnabled && currentLocale === 'en') {
    return null;
  }

  return (
    <div className="space-y-2 mt-6">
      <Label htmlFor="locale">Language</Label>
      <Select
        defaultValue={currentLocale}
        onValueChange={onChange}
        disabled={isPending}
      >
        <SelectTrigger id="locale">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          {(bgEnabled || currentLocale === 'bg') && <SelectItem value="bg">Български</SelectItem>}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Choose the application language.
      </p>
    </div>
  );
}
