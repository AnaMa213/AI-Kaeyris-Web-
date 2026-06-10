import { z } from "zod";

export const sessionCreateSchema = z.object({
  title: z
    .string({ message: "Titre requis." })
    .trim()
    .min(1, "Titre requis.")
    .max(500, "Titre trop long (500 caractères max)."),
  recorded_at: z
    .string({ message: "Date de la séance requise." })
    .min(1, "Date de la séance requise.")
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Date de la séance invalide.",
    ),
  // GM-chosen at creation, immutable afterwards. Always sent explicitly on the
  // wire: the backend default is `diarised`, but the V1 pipeline expects
  // `non_diarised`, so we default to it here rather than relying on the server.
  transcription_mode: z
    .enum(["non_diarised", "diarised"])
    .default("non_diarised"),
});

/** Parsed (output) shape — `transcription_mode` is always present. */
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
/** Raw form (input) shape — `transcription_mode` is optional (schema default). */
export type SessionCreateFormInput = z.input<typeof sessionCreateSchema>;

export const sessionUpdateSchema = z.object({
  title: z
    .string({ message: "Titre requis." })
    .trim()
    .min(1, "Titre requis.")
    .max(500, "Titre trop long (500 caractères max)."),
  campaign_context: z
    .string()
    .trim()
    .max(8000, "Contexte trop long (8000 caractères max).")
    .optional(),
});

export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;

/**
 * Convert a `datetime-local` input ("YYYY-MM-DDTHH:mm") into an ISO-8601
 * UTC string ("YYYY-MM-DDTHH:mm:ss.sssZ"). The local string is interpreted
 * in the machine's timezone, then serialised as UTC — which is what the
 * backend's `recorded_at` field expects.
 */
export function toIsoUtc(local: string): string {
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid local datetime: ${local}`);
  }
  return date.toISOString();
}
