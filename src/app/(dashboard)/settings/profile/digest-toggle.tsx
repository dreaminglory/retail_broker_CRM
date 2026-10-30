'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateDigestEnabledAction } from './actions';

type DigestToggleProps = {
  currentEnabled: boolean;
};

export function DigestToggle({ currentEnabled }: DigestToggleProps) {
  const t = useTranslations('SettingsProfile');
  const [enabled, setEnabled] = useState(currentEnabled);
  const [isPending, startTransition] = useTransition();

  function onChange(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await updateDigestEnabledAction(next);
      if (res.success) {
        toast.success(next ? t('digestOn') : t('digestOff'));
      } else {
        setEnabled(!next);
        toast.error(t('digestError'));
      }
    });
  }

  return (
    <div className="mt-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Label id="digest_enabled_label" htmlFor="digest_enabled">{t('digest')}</Label>
        <p id="digest_enabled_help" className="text-xs text-muted-foreground">{t('digestHelp')}</p>
      </div>
      <Switch
        id="digest_enabled"
        aria-labelledby="digest_enabled_label"
        aria-describedby="digest_enabled_help"
        checked={enabled}
        onCheckedChange={onChange}
        disabled={isPending}
      />
    </div>
  );
}
