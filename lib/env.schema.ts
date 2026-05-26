import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

export const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_MOCK_AUDIO: booleanString,
  NEXT_PUBLIC_MOCK_PJ_DELETE: booleanString,
  NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: booleanString,
});

export type Env = z.infer<typeof envSchema>;
