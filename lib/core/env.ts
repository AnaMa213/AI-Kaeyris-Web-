import { envSchema, type Env } from "./env.schema";

export type { Env };
export { envSchema };

const rawEnv = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_MOCK_AUDIO: process.env.NEXT_PUBLIC_MOCK_AUDIO,
  NEXT_PUBLIC_MOCK_PJ_DELETE: process.env.NEXT_PUBLIC_MOCK_PJ_DELETE,
  NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED:
    process.env.NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const fields = parsed.error.flatten().fieldErrors;
  const message = Object.entries(fields)
    .map(([name, msgs]) => `  - ${name}: ${(msgs ?? []).join("; ")}`)
    .join("\n");
  throw new Error(
    `Invalid environment variables. Check your .env.local against .env.example.\n${message}`,
  );
}

export const env: Readonly<Env> = Object.freeze(parsed.data);
