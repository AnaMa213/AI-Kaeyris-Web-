import { z } from "zod";

export const pjCreateSchema = z.object({
  name: z
    .string({ message: "Nom du PJ requis." })
    .trim()
    .min(1, "Nom du PJ requis.")
    .max(80, "Nom du PJ trop long (80 caractères max)."),
});

export type PjCreateInput = z.infer<typeof pjCreateSchema>;
