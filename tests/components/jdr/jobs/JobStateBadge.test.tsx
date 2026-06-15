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

const { JobStateBadge } = await import("@/components/jdr/jobs/JobStateBadge");
const { jobQueryKey } = await import("@/lib/jdr/jobs/queries");
import type { JobOut } from "@/lib/jdr/jobs/queries";

const baseJob: JobOut = {
  id: "job-1",
  kind: "transcription",
  session_id: "ses-1",
  status: "queued",
  failure_reason: null,
  queued_at: "2026-05-30T20:00:00+00:00",
  started_at: null,
  ended_at: null,
};

function renderWithCache(job: JobOut | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (job) client.setQueryData(jobQueryKey(job.id), job);
  render(
    <QueryClientProvider client={client}>
      <JobStateBadge jobId={baseJob.id} />
    </QueryClientProvider>,
  );
}

describe("<JobStateBadge>", () => {
  test("returns null when the job is not in the cache", () => {
    const { container } = render(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <JobStateBadge jobId="missing-job" />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  test("queued → outline badge labelled 'En file'", () => {
    renderWithCache({ ...baseJob, status: "queued" });
    const badge = screen.getByLabelText(
      "État de la transcription : En file",
    );
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe("En file");
    expect(badge.className).not.toMatch(/animate-pulse/);
  });

  test("running → outline badge labelled 'Transcription en cours' with animate-pulse", () => {
    renderWithCache({ ...baseJob, status: "running" });
    const badge = screen.getByLabelText(
      "État de la transcription : Transcription en cours",
    );
    expect(badge.textContent).toBe("Transcription en cours");
    expect(badge.className).toMatch(/animate-pulse/);
  });

  test("succeeded → outline badge labelled 'Transcrite' with success color", () => {
    renderWithCache({ ...baseJob, status: "succeeded" });
    const badge = screen.getByLabelText(
      "État de la transcription : Transcrite",
    );
    expect(badge.textContent).toBe("Transcrite");
    expect(badge.className).toMatch(/state-success/);
  });

  test("failed → destructive badge labelled 'Échec'", () => {
    renderWithCache({ ...baseJob, status: "failed" });
    const badge = screen.getByLabelText("État de la transcription : Échec");
    expect(badge.textContent).toBe("Échec");
    // shadcn destructive variant uses a bg- / text- prefix from the
    // generated CVA class; assert the variant flag presence via class fragment.
    expect(badge.className).toMatch(/destructive/);
  });

  test("custom labels + aria prefix drive the wording (Story 4.3 artifact job)", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(jobQueryKey(baseJob.id), {
      ...baseJob,
      kind: "summary",
      status: "running",
    });
    render(
      <QueryClientProvider client={client}>
        <JobStateBadge
          jobId={baseJob.id}
          ariaLabelPrefix="État de la génération"
          labels={{
            queued: "En file",
            running: "Génération en cours",
            succeeded: "Généré",
            failed: "Échec",
          }}
        />
      </QueryClientProvider>,
    );
    const badge = screen.getByLabelText("État de la génération : Génération en cours");
    expect(badge.textContent).toBe("Génération en cours");
  });

  test("without explicit labels, an artifact job derives its wording from kind", () => {
    // Bug — le chip de séance ne passe pas de labels : un job d'artefact doit
    // afficher « Génération du résumé », pas « Transcription en cours ».
    renderWithCache({ ...baseJob, kind: "summary", status: "running" });
    const badge = screen.getByLabelText(
      "État de la génération : Génération du résumé",
    );
    expect(badge.textContent).toBe("Génération du résumé");
    expect(badge.className).toMatch(/animate-pulse/);
  });
});
