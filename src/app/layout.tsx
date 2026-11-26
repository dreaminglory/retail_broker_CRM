import type { Metadata } from "next";
import { Sofia_Sans, Sofia_Sans_Semi_Condensed } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const sofiaSans = Sofia_Sans({
  variable: "--font-sofia-sans",
  subsets: ["latin", "cyrillic"],
});

const sofiaSansCondensed = Sofia_Sans_Semi_Condensed({
  variable: "--font-sofia-sans-condensed",
  subsets: ["latin", "cyrillic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.root");
  return {
    title: t("title"),
    description: t("description"),
  };
}

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("ui");

  return (
    <html
      lang={locale}
      className={`${sofiaSans.variable} ${sofiaSansCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="bottom-right" containerAriaLabel={t("notifications")} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
