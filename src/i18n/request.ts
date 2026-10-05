import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;

  const locale = (locales.includes(localeCookie as any)
    ? localeCookie
    : defaultLocale) as string;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
