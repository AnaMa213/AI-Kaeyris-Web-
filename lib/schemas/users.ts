import { z } from "zod";

export const profileSchema = z.enum(["gm", "user"], {
  message: "Profil doit être 'gm' ou 'user' (sensible à la casse).",
});

export const userStatusSchema = z.enum(["active", "inactive", "deleted"]);

export const userCreateSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis."),
  profile: profileSchema,
  password: z.string().min(1, "Mot de passe requis."),
});

export const userUpdateSchema = z.object({
  profile: profileSchema.optional(),
  password: z.string().min(1, "Mot de passe requis.").optional(),
  status: userStatusSchema.optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
