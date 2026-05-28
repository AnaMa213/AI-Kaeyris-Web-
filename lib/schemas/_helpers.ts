import { z } from "zod";

// Helper fields with French error messages that apply to both:
//   - type errors (`{ message: "..." }` on `z.string()`) — covers `undefined`/wrong type
//   - empty-string errors (`.min(1, "...")`) — covers empty input
// Without the top-level `message`, missing fields fall back to Zod's default English message.

export const usernameField = z
  .string({ message: "Nom d'utilisateur requis." })
  .min(1, "Nom d'utilisateur requis.");

export const passwordField = z
  .string({ message: "Mot de passe requis." })
  .min(1, "Mot de passe requis.");
