import type { MemberRole } from "@/lib/roles";

/** Who is signed in, loaded once by the dashboard layout for the sidebar and header. */
export type ShellUser = {
  fullName: string;
  email: string;
  role: MemberRole;
};
