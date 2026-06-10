// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const { ElementsArtifactPanel } = await import(
  "@/components/jdr/sessions/ElementsArtifactPanel"
);

const SESSION_ID = "00000000-0000-0000-0000-000000000abc";
const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";

const elementsOut = {
  session_id: SESSION_ID,
  npcs: [{ name: "Grom", description: "Forgeron taciturne." }],
  locations: [{ name: "La crypte", description: "Humide et oubliée." }],
  items: [],
  clues: [],
  model_used: "claude-x",
  generated_at: "2026-06-01T10:00:00Z",
};

function stub(opts: { elements?: boolean; jobStatus?: string; getStatus?: number }) {
  let generated = Boolean(opts.elements);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      if (url.includes("/artifacts/elements") && method.toUpperCase() === "POST") {
        generated = true;
        return new Response(
          JSON.stringify({ id: "job-ele", kind: "elements", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/artifacts/elements")) {
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
        return new Response(JSON.stringify(elementsOut), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/jobs/job-ele")) {
        return new Response(
          JSON.stringify({ id: "job-ele", kind: "elements", session_id: SESSION_ID, status: opts.jobStatus ?? "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
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
      <ElementsArtifactPanel sessionId={SESSION_ID} campaignId={CAMPAIGN_ID} />
    </QueryClientProvider>,
  );
};

beforeEach(() => toastErrorMock.mockClear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<ElementsArtifactPanel> (Story 4.4)", () => {
  test("absent elements → shows the 'Générer les Éléments' trigger", async () => {
    stub({ elements: false });
    renderPanel();
    expect(
      await screen.findByRole("button", { name: /Générer les Éléments/i }),
    ).toBeInTheDocument();
  });

  test("does not expose the trigger while the existing elements check is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes("/artifacts/elements")) {
          return new Promise<Response>(() => {});
        }
        return new Response(null, { status: 200 });
      }),
    );
    renderPanel();
    expect(
      await screen.findByText(/Vérification des éléments existants/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Générer les Éléments/i }),
    ).not.toBeInTheDocument();
  });

  test("a non-absence GET error is surfaced instead of showing a generate trigger", async () => {
    stub({ getStatus: 500 });
    renderPanel();
    expect(
      await screen.findByText(/Impossible de vérifier les éléments existants/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Générer les Éléments/i }),
    ).not.toBeInTheDocument();
  });

  test("existing elements render the four groups, empty ones as 'Aucun', with a regenerate CTA", async () => {
    stub({ elements: true });
    renderPanel();
    expect(await screen.findByText("Grom")).toBeInTheDocument();
    expect(screen.getByText("La crypte")).toBeInTheDocument();
    // Objets + Indices are empty → rendered as "Aucun" (two occurrences).
    expect(screen.getAllByText("Aucun")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Générer les Éléments" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Régénérer les Éléments" }),
    ).toBeInTheDocument();
  });

  test("clicking triggers POST, follows the job, then renders the groups", async () => {
    stub({ elements: false, jobStatus: "succeeded" });
    renderPanel();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Générer les Éléments" }),
    );
    const card = await screen.findByLabelText(
      "Éléments de la séance",
      {},
      { timeout: 4000 },
    );
    expect(within(card).getByText("Grom")).toBeInTheDocument();
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
        if (url.includes("/artifacts/elements") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: "job-ele", kind: "elements", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/elements")) {
          const npcName = postCount > 0 ? "Vael" : "Grom";
          return new Response(
            JSON.stringify({ ...elementsOut, npcs: [{ name: npcName, description: "PNJ." }] }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/jobs/job-ele")) {
          return new Response(
            JSON.stringify({ id: "job-ele", kind: "elements", session_id: SESSION_ID, status: "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: null }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    expect(await screen.findByText("Grom")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Régénérer les Éléments" }),
    );
    await user.click(screen.getByRole("button", { name: "Régénérer" }));
    expect(
      await screen.findByText("Vael", {}, { timeout: 4000 }),
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
        if (url.includes("/artifacts/elements") && method.toUpperCase() === "POST") {
          postCount += 1;
          return new Response(
            JSON.stringify({ id: `job-fail-${postCount}`, kind: "elements", session_id: SESSION_ID, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/artifacts/elements")) {
          // Generation failed → the artifact never materialises.
          return new Response(JSON.stringify({ type: "about:blank", title: "absent", status: 404 }), {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          });
        }
        if (url.includes("/jobs/job-fail-")) {
          return new Response(
            JSON.stringify({ id: "job-fail", kind: "elements", session_id: SESSION_ID, status: "failed", failure_reason: "LLM provider unreachable", queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: "2026-06-01T10:00:02Z" }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPanel();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Générer les Éléments" }),
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
