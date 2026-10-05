import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth.forgotPassword");
  return {
    title: `${t("title")} | BrokerCRM`,
  };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
