export const locales = ['en', 'bg'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en'; // We'll switch to bg in slice 5.5
