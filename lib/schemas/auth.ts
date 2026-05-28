import { z } from "zod";

const usernameField = z
  .string({ message: "Nom d'utilisateur requis." })
  .min(1, "Nom d'utilisateur requis.");

const passwordField = z
  .string({ message: "Mot de passe requis." })
  .min(1, "Mot de passe requis.");

export const loginSchema = z.object({
  username: usernameField,
  profile: z.literal("gm"),
  password: passwordField,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const setupSchema = z.object({
  username: usernameField,
  password: passwordField,
});

export type SetupInput = z.infer<typeof setupSchema>;
