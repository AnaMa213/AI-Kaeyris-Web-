import { describe, expect, test } from "vitest";
import { deriveSessionPipelineState } from "@/lib/jdr/sessions/pipelineState";

describe("deriveSessionPipelineState — projection 5→3 actes", () => {
  test("created + idle → idle", () => {
    expect(
      deriveSessionPipelineState({ cardPhase: "idle", sessionState: "created" }),
    ).toBe("idle");
  });

  test("audio_uploaded + idle → transcribing", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "idle",
        sessionState: "audio_uploaded",
      }),
    ).toBe("transcribing");
  });

  test("transcribing + idle → transcribing", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "idle",
        sessionState: "transcribing",
      }),
    ).toBe("transcribing");
  });

  test("transcribed + idle → transcribed", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "idle",
        sessionState: "transcribed",
      }),
    ).toBe("transcribed");
  });

  test("transcription_failed + idle → failed", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "idle",
        sessionState: "transcription_failed",
      }),
    ).toBe("failed");
  });

  test("cardPhase reducing/preparing/uploading écrase sessionState → uploading", () => {
    for (const cardPhase of ["reducing", "preparing", "uploading"] as const) {
      expect(
        deriveSessionPipelineState({ cardPhase, sessionState: "created" }),
      ).toBe("uploading");
      // même quand le backend dit transcribed, l'upload local en vol prime.
      expect(
        deriveSessionPipelineState({ cardPhase, sessionState: "transcribed" }),
      ).toBe("uploading");
    }
  });

  test("jobStatus failed écrase sessionState transcribing → failed", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "idle",
        sessionState: "transcribing",
        jobStatus: "failed",
      }),
    ).toBe("failed");
  });

  test("jobStatus succeeded écrase sessionState transcribing → transcribed", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "idle",
        sessionState: "transcribing",
        jobStatus: "succeeded",
      }),
    ).toBe("transcribed");
  });

  test("priorité cardPhase > jobStatus (upload local en vol prime sur un job failed résiduel)", () => {
    expect(
      deriveSessionPipelineState({
        cardPhase: "uploading",
        sessionState: "transcription_failed",
        jobStatus: "failed",
      }),
    ).toBe("uploading");
  });
});
