import { z } from "zod";
import { passwordField, usernameField } from "@/lib/schemas/_helpers";

export const profileSchema = z.enum(["gm", "user"], {
  message: "Profil doit être 'gm' ou 'user' (sensible à la casse).",
});

export const userStatusSchema = z.enum(["active", "inactive", "deleted"]);

export const userCreateSchema = z.object({
  username: usernameField,
  profile: profileSchema,
  password: passwordField,
});

export const userUpdateSchema = z.object({
  profile: profileSchema.optional(),
  password: passwordField.optional(),
  status: userStatusSchema.optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
