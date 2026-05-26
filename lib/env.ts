import { envSchema, type Env } from "./env.schema";

export type { Env };
export { envSchema };

const parsed = envSchema.safeParse(process.env);

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
