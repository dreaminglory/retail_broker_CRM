import { getLocale } from 'next-intl/server';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistance } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';

export function formatDate(date: Date | string | number, formatStr: string = 'PP', locale: string = 'en') {
  const d = new Date(date);
  const dateLocale = locale === 'bg' ? bg : enUS;
  return dateFnsFormat(d, formatStr, { locale: dateLocale });
}

export function formatRelative(date: Date | string | number, locale: string = 'en') {
  const d = new Date(date);
  const dateLocale = locale === 'bg' ? bg : enUS;
  return dateFnsFormatDistance(d, { addSuffix: true, locale: dateLocale });
}

export function formatCurrency(amount: number, currency: string = 'EUR', locale: string = 'en', options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...options
  }).format(amount);
}

export function formatNumber(amount: number, locale: string = 'en') {
  return new Intl.NumberFormat(locale).format(amount);
}

export async function getFormatters() {
  const locale = await getLocale();

  return {
    formatDate: (date: Date | string | number, formatStr?: string) => formatDate(date, formatStr, locale),
    formatRelative: (date: Date | string | number) => formatRelative(date, locale),
    formatCurrency: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => formatCurrency(amount, currency, locale, options),
    formatNumber: (amount: number) => formatNumber(amount, locale)
  };
}
