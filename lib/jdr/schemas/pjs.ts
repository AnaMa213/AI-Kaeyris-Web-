import { z } from "zod";

// Shared name rules for create and edit (a safe subset of the backend's 255).
const pjNameField = z
  .string({ message: "Nom du PJ requis." })
  .trim()
  .min(1, "Nom du PJ requis.")
  .max(80, "Nom du PJ trop long (80 caractères max).");

export const pjCreateSchema = z.object({
  name: pjNameField,
  // Liaison joueur optionnelle dès la création (Bug 3). "" = non lié → mappé en
  // `null` à la frontière de la mutation, comme en édition.
  userId: z.string().optional(),
});

// Edit payload. `userId` is the picker's value: "" means "unlinked" (mapped to
// an explicit `null` at the mutation boundary), any other value is a user UUID.
export const pjUpdateSchema = z.object({
  name: pjNameField,
  userId: z.string(),
});

export type PjCreateInput = z.infer<typeof pjCreateSchema>;
export type PjUpdateInput = z.infer<typeof pjUpdateSchema>;
