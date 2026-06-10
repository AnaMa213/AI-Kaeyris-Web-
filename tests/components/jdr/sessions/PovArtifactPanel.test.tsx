// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastErrorMock(...a) },
}));

const { PovArtifactPanel } = await import(
  "@/components/jdr/sessions/PovArtifactPanel"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

function stub(opts: { declared?: string[]; jobStatus?: string; playersStatus?: number }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (url.includes(`/sessions/${SESSION_ID}/players`)) {
        if (opts.playersStatus && opts.playersStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "players error",
              status: opts.playersStatus,
            }),
            {
              status: opts.playersStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, pj_ids: opts.declared ?? [], updated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/artifacts/povs") && method.toUpperCase() === "POST") {
        return new Response(
          JSON.stringify({ id: "job-pov", kind: "povs", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/jobs/job-pov")) {
        return new Response(
          JSON.stringify({ id: "job-pov", kind: "povs", session_id: SESSION_ID, status: opts.jobStatus ?? "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(null, { status: 200 });
    }),
  );
}

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PovArtifactPanel sessionId={SESSION_ID} campaignId={CAMPAIGN_ID} />
    </QueryClientProvider>,
  );
};

beforeEach(() => toastErrorMock.mockClear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<PovArtifactPanel> (Story 4.4)", () => {
  test("no PJ declared → trigger disabled with a hint", async () => {
    stub({ declared: [] });
    renderPanel();
    const button = await screen.findByRole("button", { name: /Générer les POVs/i });
    expect(button).toBeDisabled();
    expect(await screen.findByText(/Déclare d'abord les PJs/i)).toBeInTheDocument();
  });

  test("players GET error keeps the trigger disabled with an explicit error", async () => {
    stub({ playersStatus: 500 });
    renderPanel();
    const button = await screen.findByRole("button", { name: /Générer les POVs/i });
    expect(button).toBeDisabled();
    expect(
      await screen.findByText(/Impossible de vérifier les PJs présents/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Déclare d'abord les PJs/i)).not.toBeInTheDocument();
  });

  test("PJ declared → clicking POSTs /artifacts/povs and follows the job to a confirmation", async () => {
    stub({ declared: ["pj-1"], jobStatus: "succeeded" });
    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: /Générer les POVs/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByText(/POVs générés/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const posted = fetchMock.mock.calls.some((args) => {
      const request = args[0] as Request;
      return request.url.includes("/artifacts/povs") && request.method === "POST";
    });
    expect(posted).toBe(true);
  });

  // Story 4.5 — regenerate from the post-success confirmation → second POST.
  test("after success, regenerate → confirm → second POST /artifacts/povs", async () => {
    stub({ declared: ["pj-1"], jobStatus: "succeeded" });
    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Générer les POVs" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByText(/POVs générés/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Régénérer les POVs" }));
    await user.click(screen.getByRole("button", { name: "Régénérer" }));

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    await waitFor(() => {
      const postCount = fetchMock.mock.calls.filter((args) => {
        const request = args[0] as Request;
        return (
          request.url.includes("/artifacts/povs") && request.method === "POST"
        );
      }).length;
      expect(postCount).toBe(2);
    });
  });

  test("failed regeneration keeps the generated state and retry behind confirm", async () => {
    let postCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? "GET" : (input.method ?? "GET");
        if (url.includes(`/sessions/${SESSION_ID}/players`)) {
          return new Response(
            JSON.stringify({
              session_id: SESSION_ID,
              pj_ids: ["pj-1"],
              updated_at: "2026-06-01T10:00:00Z",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/povs") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({
              id: `job-pov-${postCount}`,
              kind: "povs",
              session_id: SESSION_ID,
              status: "queued",
              queued_at: "2026-06-01T10:00:00Z",
            }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/jobs/job-pov-")) {
          const failedRegen = url.includes("/jobs/job-pov-2");
          return new Response(
            JSON.stringify({
              id: failedRegen ? "job-pov-2" : "job-pov-1",
              kind: "povs",
              session_id: SESSION_ID,
              status: failedRegen ? "failed" : "succeeded",
              failure_reason: failedRegen ? "LLM error" : null,
              queued_at: "2026-06-01T10:00:00Z",
              started_at: "2026-06-01T10:00:01Z",
              ended_at: "2026-06-01T10:00:02Z",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Générer les POVs" }),
    );
    expect(
      await screen.findByText(/POVs générés/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Régénérer les POVs" }));
    await user.click(screen.getByRole("button", { name: "Régénérer" }));

    // Story 4.10 — ArtifactRegenerateControls must surface the backend reason inline,
    // not just the generic "La régénération a échoué.".
    expect(
      await screen.findByText(
        /La régénération a échoué : LLM error/i,
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/POVs générés/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Réessayer" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Régénérer les POVs" }));
    expect(postCount).toBe(2);
    await user.click(screen.getByRole("button", { name: "Régénérer" }));
    expect(postCount).toBe(3);
  });

  // Story 4.10 — a failed first generation must not be silent: inline reason + toast + retry.
  test("a failed generation surfaces the failure_reason inline + toast, with a Réessayer retry", async () => {
    let postCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? "GET" : (input.method ?? "GET");
        if (url.includes(`/sessions/${SESSION_ID}/players`)) {
          return new Response(
            JSON.stringify({ session_id: SESSION_ID, pj_ids: ["pj-1"], updated_at: "2026-06-01T10:00:00Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/povs") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: `job-fail-${postCount}`, kind: "povs", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/jobs/job-fail-")) {
          return new Response(
            JSON.stringify({ id: "job-fail", kind: "povs", session_id: SESSION_ID, status: "failed", failure_reason: "LLM provider unreachable", queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: "2026-06-01T10:00:02Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Générer les POVs" }),
    );

    expect(
      await screen.findByText(/LLM provider unreachable/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("LLM provider unreachable"),
    );

    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(postCount).toBe(2));
  });
});
