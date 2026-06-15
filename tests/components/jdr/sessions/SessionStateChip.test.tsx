// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { SessionStateChip } = await import(
  "@/components/jdr/sessions/SessionStateChip"
);
const { jobQueryKey } = await import("@/lib/jdr/jobs/queries");
import type { JobOut } from "@/lib/jdr/jobs/queries";
import type { SessionOut } from "@/lib/jdr/sessions/queries";

const JOB_ID = "job-1";

function makeJob(overrides: Partial<JobOut>): JobOut {
  return {
    id: JOB_ID,
    kind: "summary",
    session_id: "ses-1",
    status: "running",
    failure_reason: null,
    queued_at: "2026-06-01T10:00:00Z",
    started_at: "2026-06-01T10:00:01Z",
    ended_at: null,
    ...overrides,
  };
}

function renderChip(opts: {
  state: SessionOut["state"];
  currentJobId: string | null;
  job?: JobOut;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (opts.job) client.setQueryData(jobQueryKey(opts.job.id), opts.job);
  render(
    <QueryClientProvider client={client}>
      <SessionStateChip state={opts.state} currentJobId={opts.currentJobId} />
    </QueryClientProvider>,
  );
}

describe("<SessionStateChip>", () => {
  test("an in-flight artifact job shows a generic 'Génération en cours'", () => {
    renderChip({
      state: "transcribed",
      currentJobId: JOB_ID,
      job: makeJob({ kind: "summary", status: "running" }),
    });
    const chip = screen.getByLabelText("État de la séance : Génération en cours");
    expect(chip.textContent).toBe("Génération en cours");
    expect(chip.className).toMatch(/animate-pulse/);
  });

  test("a queued artifact job also reads as generating", () => {
    renderChip({
      state: "transcribed",
      currentJobId: JOB_ID,
      job: makeJob({ kind: "povs", status: "queued" }),
    });
    expect(
      screen.getByLabelText("État de la séance : Génération en cours"),
    ).toBeInTheDocument();
  });

  test("once the artifact job is done, the chip reverts to 'Transcrite' (no '… généré')", () => {
    renderChip({
      state: "transcribed",
      currentJobId: JOB_ID,
      job: makeJob({ kind: "summary", status: "succeeded" }),
    });
    expect(
      screen.getByLabelText("État de la séance : Transcrite"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Génération en cours")).not.toBeInTheDocument();
    expect(screen.queryByText("Résumé généré")).not.toBeInTheDocument();
  });

  test("a transcription job keeps the live transcription wording", () => {
    renderChip({
      state: "transcribing",
      currentJobId: JOB_ID,
      job: makeJob({ kind: "transcription", status: "running" }),
    });
    expect(
      screen.getByLabelText("État de la transcription : Transcription en cours"),
    ).toBeInTheDocument();
  });

  test("without a current job, it renders the static session state", () => {
    renderChip({ state: "transcribed", currentJobId: null });
    expect(
      screen.getByLabelText("État de la séance : Transcrite"),
    ).toBeInTheDocument();
  });
});
