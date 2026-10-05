'use client';

import { useTranslations } from 'next-intl';

interface FieldErrorProps {
  error?: string[] | string;
}

export function FieldError({ error }: FieldErrorProps) {
  const t = useTranslations('Errors');

  if (!error) return null;

  const errorKey = Array.isArray(error) ? error[0] : error;
  
  // Zod often returns keys or messages. Here we try to map them to i18n keys
  let translated = errorKey;
  try {
    // If it's a known key in Errors namespace, use it.
    // We fall back to the string itself if translation is missing (or try/catch block)
    translated = t(errorKey as any) || errorKey;
  } catch (e) {
    translated = errorKey;
  }

  return (
    <p className="text-[0.8rem] font-medium text-destructive mt-1">
      {translated}
    </p>
  );
}
