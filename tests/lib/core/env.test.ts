import { describe, expect, test } from "vitest";
import { envSchema } from "@/lib/core/env.schema";

const validEnv = {
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
  NEXT_PUBLIC_MOCK_AUDIO: "true",
  NEXT_PUBLIC_MOCK_PJ_DELETE: "true",
  NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: "false",
};

describe("envSchema", () => {
  test("parses a valid env object and coerces booleans", () => {
    const result = envSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:8000");
    expect(result.data.NEXT_PUBLIC_MOCK_AUDIO).toBe(true);
    expect(result.data.NEXT_PUBLIC_MOCK_PJ_DELETE).toBe(true);
    expect(result.data.NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED).toBe(false);
  });

  test("fails when NEXT_PUBLIC_API_BASE_URL is missing, naming the field", () => {
    const { NEXT_PUBLIC_API_BASE_URL: _omit, ...partial } = validEnv;
    void _omit;
    const result = envSchema.safeParse(partial);

    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldNames = Object.keys(result.error.flatten().fieldErrors);
    expect(fieldNames).toContain("NEXT_PUBLIC_API_BASE_URL");
  });

  test("fails when a boolean var is malformed (e.g. 'maybe'), naming the field", () => {
    const malformed = { ...validEnv, NEXT_PUBLIC_MOCK_AUDIO: "maybe" };
    const result = envSchema.safeParse(malformed);

    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldNames = Object.keys(result.error.flatten().fieldErrors);
    expect(fieldNames).toContain("NEXT_PUBLIC_MOCK_AUDIO");
  });

  test("fails when NEXT_PUBLIC_API_BASE_URL is not a valid URL, naming the field", () => {
    const malformed = { ...validEnv, NEXT_PUBLIC_API_BASE_URL: "not-a-url" };
    const result = envSchema.safeParse(malformed);

    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldNames = Object.keys(result.error.flatten().fieldErrors);
    expect(fieldNames).toContain("NEXT_PUBLIC_API_BASE_URL");
  });
});
