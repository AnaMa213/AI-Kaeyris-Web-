import { describe, expect, test } from "vitest";
import { estimateJobProgress } from "@/lib/jdr/jobs/progress";
import type { JobOut } from "@/lib/jdr/jobs/queries";

const baseJob: JobOut = {
  id: "job-1",
  kind: "transcription",
  session_id: "ses-1",
  status: "running",
  failure_reason: null,
  queued_at: "2026-05-30T20:00:00+00:00",
  started_at: "2026-05-30T20:00:10+00:00",
  ended_at: null,
};

const NOW = new Date("2026-05-30T20:00:10+00:00").getTime();

describe("estimateJobProgress", () => {
  test("undefined job → null", () => {
    expect(
      estimateJobProgress({ job: undefined, durationSeconds: 600, now: NOW }),
    ).toBeNull();
  });

  test("backend job.progress wins over the estimate (adapter), clamped 0..100", () => {
    const job = { ...baseJob, progress: 42 } as JobOut & { progress: number };
    expect(
      estimateJobProgress({ job, durationSeconds: 600, now: NOW }),
    ).toBe(42);
    const over = { ...baseJob, progress: 140 } as JobOut & { progress: number };
    expect(
      estimateJobProgress({ job: over, durationSeconds: 600, now: NOW }),
    ).toBe(100);
  });

  test("succeeded → 100", () => {
    expect(
      estimateJobProgress({
        job: { ...baseJob, status: "succeeded" },
        durationSeconds: 600,
        now: NOW,
      }),
    ).toBe(100);
  });

  test("queued → 0", () => {
    expect(
      estimateJobProgress({
        job: { ...baseJob, status: "queued", started_at: null },
        durationSeconds: 600,
        now: NOW,
      }),
    ).toBe(0);
  });

  test("failed → null (no progress bar)", () => {
    expect(
      estimateJobProgress({
        job: { ...baseJob, status: "failed" },
        durationSeconds: 600,
        now: NOW,
      }),
    ).toBeNull();
  });

  test("running without durationSeconds → null (indeterminate)", () => {
    expect(
      estimateJobProgress({ job: baseJob, durationSeconds: null, now: NOW }),
    ).toBeNull();
  });

  test("running without started_at → null (indeterminate)", () => {
    expect(
      estimateJobProgress({
        job: { ...baseJob, started_at: null },
        durationSeconds: 600,
        now: NOW,
      }),
    ).toBeNull();
  });

  test("running with duration → estimated %, factor 1, half elapsed ≈ 50%", () => {
    // started_at = 20:00:10, duration 600s, factor 1 → estTotal 600s.
    // now = started + 300s → 50%.
    const now = new Date("2026-05-30T20:05:10+00:00").getTime();
    expect(
      estimateJobProgress({ job: baseJob, durationSeconds: 600, now }),
    ).toBe(50);
  });

  test("running long past the estimate caps at 95%", () => {
    const now = new Date("2026-05-30T21:00:10+00:00").getTime(); // +1h
    expect(
      estimateJobProgress({ job: baseJob, durationSeconds: 600, now }),
    ).toBe(95);
  });
});
