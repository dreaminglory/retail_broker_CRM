import { createSupabaseServer } from '@/lib/supabase/server';
import { ProfileRepository } from '@/domain/profiles/repository';
import { ProfileForm } from './profile-form';
import { LanguageSwitcher } from './language-switcher';

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
  const bgEnabled = process.env.NEXT_PUBLIC_I18N_BG_ENABLED === 'true';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal information. Your display name is visible to all
          team members.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <label className="text-sm font-medium text-muted-foreground">
            Email
          </label>
          <p className="text-sm">{profile?.email ?? user.email}</p>
        </div>

        <ProfileForm
          currentDisplayName={profile?.display_name ?? ''}
        />

        <LanguageSwitcher
          currentLocale={profile?.locale ?? 'en'}
          bgEnabled={bgEnabled}
        />
      </div>
    </div>
  );
}
