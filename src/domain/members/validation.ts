import { z } from "zod";

export const memberRoleSchema = z.enum(["owner", "manager", "broker"]);
export const memberStatusSchema = z.enum(["active", "invited", "deactivated"]);

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: memberRoleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const deactivateMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

export type DeactivateMemberInput = z.infer<typeof deactivateMemberSchema>;

export const reactivateMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

export type ReactivateMemberInput = z.infer<typeof reactivateMemberSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: memberRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
