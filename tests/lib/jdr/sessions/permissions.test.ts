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

describe("canReplaceAudio (Story 3.5)", () => {
  test("allows replace on audio_uploaded and transcription_failed", () => {
    expect(canReplaceAudio("audio_uploaded")).toBe(true);
    expect(canReplaceAudio("transcription_failed")).toBe(true);
  });

  test("hides replace on created, transcribing and transcribed (locked or no prior audio)", () => {
    expect(canReplaceAudio("created")).toBe(false);
    expect(canReplaceAudio("transcribing")).toBe(false);
    expect(canReplaceAudio("transcribed")).toBe(false);
  });
});
