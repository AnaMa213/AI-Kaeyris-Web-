import { describe, expect, test } from "vitest";
import {
  estimateJobProgress,
  resolveDisplayProgress,
  type DisplayProgressState,
} from "@/lib/jdr/jobs/progress";
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

  test("backend progress_percent wins over the estimate (BD-10), clamped 0..100", () => {
    expect(
      estimateJobProgress({
        job: { ...baseJob, progress_percent: 42 },
        durationSeconds: 600,
        now: NOW,
      }),
    ).toBe(42);
    expect(
      estimateJobProgress({
        job: { ...baseJob, progress_percent: 140 },
        durationSeconds: 600,
        now: NOW,
      }),
    ).toBe(100);
  });

  test("progress_percent: null → falls back to the client estimate (degradation)", () => {
    // started_at = 20:00:10, duration 600s, factor 1 → estTotal 600s; +300s → 50%.
    const now = new Date("2026-05-30T20:05:10+00:00").getTime();
    expect(
      estimateJobProgress({
        job: { ...baseJob, progress_percent: null },
        durationSeconds: 600,
        now,
      }),
    ).toBe(50);
  });

  test("real progress_percent: 99 while running is not capped to the estimate's 95", () => {
    const now = new Date("2026-05-30T21:00:10+00:00").getTime(); // estimate would cap at 95
    expect(
      estimateJobProgress({
        job: { ...baseJob, progress_percent: 99 },
        durationSeconds: 600,
        now,
      }),
    ).toBe(99);
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

describe("resolveDisplayProgress (Story 3.6 — monotone display clamp)", () => {
  const fresh: DisplayProgressState = { jobId: null, value: 0 };

  test("first running value passes through and seeds the floor", () => {
    const r = resolveDisplayProgress(fresh, "job-1", 40, false);
    expect(r.value).toBe(40);
    expect(r.floor).toEqual({ jobId: "job-1", value: 40 });
  });

  test("a later lower value does NOT regress the bar (monotone)", () => {
    const seeded: DisplayProgressState = { jobId: "job-1", value: 40 };
    expect(resolveDisplayProgress(seeded, "job-1", 30, false).value).toBe(40);
  });

  test("computed null keeps the floor (degradation without regression)", () => {
    const seeded: DisplayProgressState = { jobId: "job-1", value: 40 };
    expect(resolveDisplayProgress(seeded, "job-1", null, false).value).toBe(40);
  });

  test("computed null with no floor yet → null (indeterminate)", () => {
    expect(resolveDisplayProgress(fresh, "job-1", null, false).value).toBeNull();
  });

  test("a new job id resets the floor", () => {
    const seeded: DisplayProgressState = { jobId: "job-1", value: 90 };
    const r = resolveDisplayProgress(seeded, "job-2", 10, false);
    expect(r.value).toBe(10);
    expect(r.floor).toEqual({ jobId: "job-2", value: 10 });
  });

  test("never reaches 100 while non-terminal", () => {
    expect(resolveDisplayProgress(fresh, "job-1", 100, false).value).toBe(99);
  });

  test("terminal can reach 100 (computed 100)", () => {
    const seeded: DisplayProgressState = { jobId: "job-1", value: 99 };
    expect(resolveDisplayProgress(seeded, "job-1", 100, true).value).toBe(100);
  });

  test("terminal with null computed → 100", () => {
    const seeded: DisplayProgressState = { jobId: "job-1", value: 80 };
    expect(resolveDisplayProgress(seeded, "job-1", null, true).value).toBe(100);
  });
});
