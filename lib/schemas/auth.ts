import { z } from "zod";
import { passwordField, usernameField } from "@/lib/schemas/_helpers";

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
