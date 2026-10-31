/** The app's public URL for links in emails and invites. Null in production when it isn't configured. */
export function getAppUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env.NEXT_PUBLIC_APP_URL || (env.NODE_ENV === 'production' ? null : 'http://localhost:3000');
}
