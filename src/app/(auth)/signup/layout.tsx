import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth.signup");
  return {
    title: `${t("title")} | BrokerCRM`,
  };
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
