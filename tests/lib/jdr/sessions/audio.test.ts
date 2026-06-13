import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function importWithEnv(mockAudio: boolean) {
  vi.doMock("@/lib/core/env", () => ({
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      NEXT_PUBLIC_MOCK_AUDIO: mockAudio,
      NEXT_PUBLIC_MOCK_PJ_DELETE: false,
      NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
    },
  }));

  return await import("@/lib/jdr/sessions/audio");
}

describe("resolveSessionAudioSrc", () => {
  test("returns the public demo audio in mock mode", async () => {
    const { resolveSessionAudioSrc } = await importWithEnv(true);

    expect(resolveSessionAudioSrc("session-1")).toBe(
      "/mocks/demo-session.m4a",
    );
  });

  test("returns the real session audio endpoint when mock mode is off", async () => {
    const { resolveSessionAudioSrc } = await importWithEnv(false);

    expect(resolveSessionAudioSrc("session-1")).toBe(
      "http://localhost:8000/services/jdr/sessions/session-1/audio",
    );
  });
});
