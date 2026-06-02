import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function importWithEnv(reducerRequired: boolean) {
  vi.doMock("@/lib/core/env", () => ({
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      NEXT_PUBLIC_MOCK_AUDIO: false,
      NEXT_PUBLIC_MOCK_PJ_DELETE: false,
      NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: reducerRequired,
    },
  }));
  return await import("@/lib/audio/provider");
}

describe("isReducerRequired", () => {
  test("returns true when env.NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED is true", async () => {
    const { isReducerRequired } = await importWithEnv(true);
    expect(isReducerRequired()).toBe(true);
  });

  test("returns false when env.NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED is false", async () => {
    const { isReducerRequired } = await importWithEnv(false);
    expect(isReducerRequired()).toBe(false);
  });
});

describe("shouldReduce", () => {
  const OVER_25MB = 25 * 1024 * 1024 + 1;
  const UNDER_25MB = 25 * 1024 * 1024;

  test("returns true when reducer is required AND file > 25 MB", async () => {
    const { shouldReduce } = await importWithEnv(true);
    expect(shouldReduce(OVER_25MB)).toBe(true);
  });

  test("returns false when reducer is required AND file <= 25 MB", async () => {
    const { shouldReduce } = await importWithEnv(true);
    expect(shouldReduce(UNDER_25MB)).toBe(false);
  });

  test("returns false when reducer is NOT required AND file > 25 MB", async () => {
    const { shouldReduce } = await importWithEnv(false);
    expect(shouldReduce(OVER_25MB)).toBe(false);
  });

  test("returns false when reducer is NOT required AND file <= 25 MB", async () => {
    const { shouldReduce } = await importWithEnv(false);
    expect(shouldReduce(UNDER_25MB)).toBe(false);
  });
});
