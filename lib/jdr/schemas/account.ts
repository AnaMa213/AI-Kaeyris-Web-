import { z } from "zod";
import { passwordField } from "@/lib/core/schemas/_helpers";

// Self-service password change (Story 6.1). Both fields reuse `passwordField`
// (non-empty, French error) — no length/strength rules are imposed by the
// backend or PRD, so none are invented here. The confirmation match is a
// client-side-only safeguard: the backend `UserUpdate` schema only accepts a
// single `password` (no `username`), so only `password` is ever sent.
export const accountPasswordChangeSchema = z
  .object({
    password: passwordField,
    confirmPassword: passwordField,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export type AccountPasswordChangeInput = z.infer<
  typeof accountPasswordChangeSchema
>;
