import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth.onboarding");
  return {
    title: `${t("title")} | BrokerCRM`,
  };
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
