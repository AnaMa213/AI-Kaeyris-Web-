import { describe, expect, test } from "vitest";
import { phaseToTranscribingAct } from "@/lib/jdr/sessions/transcriptionPhase";

describe("phaseToTranscribingAct", () => {
  test("reducing → reducing act", () => {
    expect(phaseToTranscribingAct("reducing")).toBe("reducing");
  });

  test("transcribing → transcribing act", () => {
    expect(phaseToTranscribingAct("transcribing")).toBe("transcribing");
  });

  test.each(["done", "failed"] as const)(
    "%s → transcribing act (decorative; status drives terminal state)",
    (phase) => {
      expect(phaseToTranscribingAct(phase)).toBe("transcribing");
    },
  );

  test("null / undefined → transcribing act (graceful degradation)", () => {
    expect(phaseToTranscribingAct(null)).toBe("transcribing");
    expect(phaseToTranscribingAct(undefined)).toBe("transcribing");
  });
});
