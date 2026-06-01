import { z } from "zod";
import { passwordField, usernameField } from "@/lib/core/schemas/_helpers";

export const systemRoleSchema = z.enum(["admin", "user"], {
  message: "Rôle système doit être 'admin' ou 'user' (sensible à la casse).",
});

export const userStatusSchema = z.enum(["active", "inactive", "deleted"]);

export const userCreateSchema = z.object({
  username: usernameField,
  system_role: systemRoleSchema,
  password: passwordField,
});

export const userUpdateSchema = z.object({
  system_role: systemRoleSchema.optional(),
  password: passwordField.optional(),
  status: userStatusSchema.optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
