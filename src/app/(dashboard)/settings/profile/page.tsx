import { createSupabaseServer } from '@/lib/supabase/server';
import { ProfileRepository } from '@/domain/profiles/repository';
import { ProfileForm } from './profile-form';
import { LanguageSwitcher } from './language-switcher';

import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("profile") };
}


export default async function ProfileSettingsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const repo = new ProfileRepository(supabase);
  const profile = await repo.getProfile(user.id);
    const t = await getTranslations("SettingsProfile");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <label className="text-sm font-medium text-muted-foreground">
            {t("emailLabel")}
          </label>
          <p className="text-sm">{profile?.email ?? user.email}</p>
        </div>

        <ProfileForm
          currentDisplayName={profile?.display_name ?? ''}
        />

        <LanguageSwitcher
          currentLocale={profile?.locale ?? 'bg'}
        />
      </div>
    </div>
  );
}
