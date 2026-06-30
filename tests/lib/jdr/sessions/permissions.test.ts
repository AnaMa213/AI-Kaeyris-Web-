import { describe, expect, test } from "vitest";
import {
  canEditCampaignSession,
  canReplaceAudio,
} from "@/lib/jdr/sessions/permissions";

describe("canEditCampaignSession", () => {
  test("returns true when role is gm", () => {
    expect(canEditCampaignSession({ role: "gm" })).toBe(true);
  });

  test("returns false when role is pj", () => {
    expect(canEditCampaignSession({ role: "pj" })).toBe(false);
  });
});

describe("canReplaceAudio (Story 3.5 / 7.1)", () => {
  test("allows replace on audio_uploaded, transcription_failed and transcribed", () => {
    expect(canReplaceAudio("audio_uploaded")).toBe(true);
    expect(canReplaceAudio("transcription_failed")).toBe(true);
    // Story 7.1 — redo the audio even after a successful transcription (e.g. to
    // recover from a failed artifact).
    expect(canReplaceAudio("transcribed")).toBe(true);
  });

  test("hides replace on created and transcribing (no prior audio / actively locked)", () => {
    expect(canReplaceAudio("created")).toBe(false);
    expect(canReplaceAudio("transcribing")).toBe(false);
  });
});
