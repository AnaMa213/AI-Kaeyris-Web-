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

const { NarrativeArtifactPanel } = await import(
  "@/components/jdr/sessions/NarrativeArtifactPanel"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";
const TEXT = "Au cœur de la nuit, les héros franchirent le seuil.";

function stub(opts: { narrative?: boolean; jobStatus?: string; getStatus?: number }) {
  let generated = Boolean(opts.narrative);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (url.includes("/artifacts/narrative") && method.toUpperCase() === "POST") {
        generated = true;
        return new Response(
          JSON.stringify({ id: "job-nar", kind: "narrative", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/artifacts/narrative")) {
        if (opts.getStatus && opts.getStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "artifact error",
              status: opts.getStatus,
            }),
            {
              status: opts.getStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        if (!generated) {
          return new Response(JSON.stringify({ type: "about:blank", title: "absent", status: 404 }), {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          });
        }
        return new Response(
          JSON.stringify({ session_id: SESSION_ID, text: TEXT, model_used: "claude-x", generated_at: "2026-06-01T10:00:00Z" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/jobs/job-nar")) {
        return new Response(
          JSON.stringify({ id: "job-nar", kind: "narrative", session_id: SESSION_ID, status: opts.jobStatus ?? "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
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
      <NarrativeArtifactPanel sessionId={SESSION_ID} campaignId={CAMPAIGN_ID} />
    </QueryClientProvider>,
  );
};

beforeEach(() => toastErrorMock.mockClear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<NarrativeArtifactPanel> (Story 4.4)", () => {
  test("absent narrative → shows the 'Générer le Récit' trigger", async () => {
    stub({ narrative: false });
    renderPanel();
    expect(
      await screen.findByRole("button", { name: /Générer le Récit/i }),
    ).toBeInTheDocument();
  });

  test("does not expose the trigger while the existing narrative check is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/artifacts/narrative")) {
          return new Promise<Response>(() => {});
        }
        return new Response(null, { status: 200 });
      }),
    );
    renderPanel();
    expect(await screen.findByText(/Vérification du récit existant/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Générer le Récit/i }),
    ).not.toBeInTheDocument();
  });

  test("a non-absence GET error is surfaced instead of showing a generate trigger", async () => {
    stub({ getStatus: 500 });
    renderPanel();
    expect(
      await screen.findByText(/Impossible de vérifier le récit existant/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Générer le Récit/i }),
    ).not.toBeInTheDocument();
  });

  test("an existing narrative is displayed with a regenerate CTA and no first-gen trigger", async () => {
    stub({ narrative: true });
    renderPanel();
    expect(await screen.findByText(TEXT)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Générer le Récit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Régénérer le Récit" }),
    ).toBeInTheDocument();
  });

  test("clicking triggers POST, follows the job, then renders the narrative", async () => {
    stub({ narrative: false, jobStatus: "succeeded" });
    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Générer le Récit" });
    await user.click(button);
    expect(
      await screen.findByText(TEXT, {}, { timeout: 4000 }),
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
        if (url.includes("/artifacts/narrative") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: "job-nar", kind: "narrative", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/narrative")) {
          const text = postCount > 0 ? "Récit régénéré." : "Récit initial.";
          return new Response(
            JSON.stringify({ session_id: SESSION_ID, text, model_used: "claude-x", generated_at: "2026-06-01T10:00:00Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/jobs/job-nar")) {
          return new Response(
            JSON.stringify({ id: "job-nar", kind: "narrative", session_id: SESSION_ID, status: "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    expect(await screen.findByText("Récit initial.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Régénérer le Récit" }));
    await user.click(screen.getByRole("button", { name: "Régénérer" }));
    expect(
      await screen.findByText("Récit régénéré.", {}, { timeout: 4000 }),
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
        if (url.includes("/artifacts/narrative") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: `job-fail-${postCount}`, kind: "narrative", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/narrative")) {
          // Generation failed → the artifact never materialises.
          return new Response(JSON.stringify({ type: "about:blank", title: "absent", status: 404 }), {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          });
        }
        if (url.includes("/jobs/job-fail-")) {
          return new Response(
            JSON.stringify({ id: "job-fail", kind: "narrative", session_id: SESSION_ID, status: "failed", failure_reason: "LLM provider unreachable", queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: "2026-06-01T10:00:02Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Générer le Récit" }),
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
