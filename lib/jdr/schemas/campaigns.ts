import { z } from "zod";

export const campaignCreateSchema = z.object({
  name: z
    .string({ message: "Nom requis." })
    .trim()
    .min(1, "Nom requis.")
    .max(200, "Nom trop long (200 caractères max)."),
  description: z
    .string()
    .trim()
    .max(4000, "Description trop longue (4000 caractères max).")
    .optional(),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = z.object({
  name: z
    .string({ message: "Nom requis." })
    .trim()
    .min(1, "Nom requis.")
    .max(200, "Nom trop long (200 caractères max)."),
  description: z
    .string()
    .trim()
    .max(4000, "Description trop longue (4000 caractères max).")
    .optional(),
});

export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
