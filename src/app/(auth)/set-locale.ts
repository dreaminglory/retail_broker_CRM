"use server";

import { cookies } from "next/headers";

/** The language picked on an auth screen, before anyone is signed in (the profile's locale wins after sign-in). */
export async function setAuthLocaleAction(locale: string): Promise<void> {
  if (locale !== "bg" && locale !== "en") return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
