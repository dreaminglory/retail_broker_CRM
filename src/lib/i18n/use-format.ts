'use client';

import { useLocale } from 'next-intl';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistance } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';
import { useCallback } from 'react';

export function useFormat() {
  const locale = useLocale();
  const dateLocale = locale === 'bg' ? bg : enUS;

  const formatDate = useCallback((date: Date | string | number, formatStr: string = 'PP') => {
    const d = new Date(date);
    return dateFnsFormat(d, formatStr, { locale: dateLocale });
  }, [dateLocale]);

  const formatRelative = useCallback((date: Date | string | number) => {
    const d = new Date(date);
    return dateFnsFormatDistance(d, { addSuffix: true, locale: dateLocale });
  }, [dateLocale]);

  const formatCurrency = useCallback((amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  }, [locale]);

  const formatNumber = useCallback((amount: number) => {
    return new Intl.NumberFormat(locale).format(amount);
  }, [locale]);

  return {
    formatDate,
    formatRelative,
    formatCurrency,
    formatNumber
  };
}
