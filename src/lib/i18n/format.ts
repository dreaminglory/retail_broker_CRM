import { getLocale } from 'next-intl/server';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistance } from 'date-fns';
import { bg, enUS } from 'date-fns/locale';

export async function getFormatters() {
  const locale = await getLocale();
  const dateLocale = locale === 'bg' ? bg : enUS;

  return {
    formatDate: (date: Date | string | number, formatStr: string = 'PP') => {
      const d = new Date(date);
      return dateFnsFormat(d, formatStr, { locale: dateLocale });
    },
    formatRelative: (date: Date | string | number) => {
      const d = new Date(date);
      return dateFnsFormatDistance(d, { addSuffix: true, locale: dateLocale });
    },
    formatCurrency: (amount: number, currency: string = 'EUR') => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    },
    formatNumber: (amount: number) => {
      return new Intl.NumberFormat(locale).format(amount);
    }
  };
}
