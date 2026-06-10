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

const { SummaryArtifactPanel } = await import(
  "@/components/jdr/sessions/SummaryArtifactPanel"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

function stub(opts: {
  declared?: string[];
  summary?: boolean;
  jobStatus?: string;
}) {
  let generated = Boolean(opts.summary);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (url.includes(`/sessions/${SESSION_ID}/players`)) {
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, pj_ids: opts.declared ?? [], updated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
        generated = true;
        return new Response(
          JSON.stringify({ id: "job-sum", kind: "summary", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/artifacts/summary")) {
        if (!generated) {
          return new Response(JSON.stringify({ type: "about:blank", title: "absent", status: 404 }), {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          });
        }
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, text: "Les héros entrent dans la crypte.", model_used: "claude-x", generated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/jobs/job-sum")) {
        return new Response(
          JSON.stringify({ id: "job-sum", kind: "summary", session_id: SESSION_ID, status: opts.jobStatus ?? "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
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
      <SummaryArtifactPanel sessionId={SESSION_ID} campaignId={CAMPAIGN_ID} />
    </QueryClientProvider>,
  );
};

beforeEach(() => toastErrorMock.mockClear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<SummaryArtifactPanel>", () => {
  test("no PJ declared → trigger disabled with a hint", async () => {
    stub({ declared: [] });
    renderPanel();
    const button = await screen.findByRole("button", { name: /Générer le Résumé/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Déclare d'abord les PJs/i)).toBeInTheDocument();
  });

  test("an existing summary is displayed with a regenerate CTA and no first-gen trigger", async () => {
    stub({ declared: ["pj-1"], summary: true });
    renderPanel();
    expect(
      await screen.findByText("Les héros entrent dans la crypte."),
    ).toBeInTheDocument();
    // First-generation trigger is gone (exact name, so it does not match the
    // regenerate CTA which contains "générer le Résumé" as a substring).
    expect(
      screen.queryByRole("button", { name: "Générer le Résumé" }),
    ).not.toBeInTheDocument();
    // Story 4.5 — regenerate CTA is available on the existing artifact.
    expect(
      screen.getByRole("button", { name: "Régénérer le Résumé" }),
    ).toBeInTheDocument();
  });

  test("PJ declared → clicking triggers POST, follows the job, then shows the summary", async () => {
    stub({ declared: ["pj-1"], jobStatus: "succeeded" });
    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Générer le Résumé" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByText("Les héros entrent dans la crypte.", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  // Story 4.5 — regeneration: confirm dialog → second POST → content replaced.
  test("regenerate → confirm → second POST → new content replaces the old", async () => {
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
        if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: "job-regen", kind: "summary", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/summary")) {
          const text = postCount > 0 ? "Résumé régénéré." : "Résumé initial.";
          return new Response(
            JSON.stringify({ session_id: SESSION_ID, text, model_used: "claude-x", generated_at: "2026-06-01T10:00:00Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/jobs/job-regen")) {
          return new Response(
            JSON.stringify({ id: "job-regen", kind: "summary", session_id: SESSION_ID, status: "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    expect(await screen.findByText("Résumé initial.")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Régénérer le Résumé" }),
    );
    // The confirm dialog opens; its confirm button has the exact name "Régénérer".
    await user.click(screen.getByRole("button", { name: "Régénérer" }));

    expect(
      await screen.findByText("Résumé régénéré.", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(postCount).toBe(1);
  });

  // Story 4.10 — a failed generation must not be silent: inline reason + toast + retry.
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
        if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: `job-fail-${postCount}`, kind: "summary", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/summary")) {
          // Generation failed → the artifact never materialises.
          return new Response(JSON.stringify({ type: "about:blank", title: "absent", status: 404 }), {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          });
        }
        if (url.includes("/jobs/job-fail-")) {
          return new Response(
            JSON.stringify({ id: "job-fail", kind: "summary", session_id: SESSION_ID, status: "failed", failure_reason: "LLM provider unreachable", queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: "2026-06-01T10:00:02Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Générer le Résumé" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(
      await screen.findByText(/LLM provider unreachable/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("LLM provider unreachable"),
    );

    const retry = screen.getByRole("button", { name: "Réessayer" });
    await user.click(retry);
    await waitFor(() => expect(postCount).toBe(2));
  });
});
