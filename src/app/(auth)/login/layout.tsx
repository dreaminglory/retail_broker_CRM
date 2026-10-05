import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return {
    title: `${t("title")} | BrokerCRM`,
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
