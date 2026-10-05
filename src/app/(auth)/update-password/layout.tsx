import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth.updatePassword");
  return {
    title: `${t("title")} | BrokerCRM`,
  };
}

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
