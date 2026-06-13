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

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
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
const PJ_1 = "pj-1";
const PJ_2 = "pj-2";

function pj(id: string, name: string) {
  return {
    id,
    name,
    campaign_id: CAMPAIGN_ID,
    user_id: null,
    created_at: "2026-06-01T09:00:00Z",
  };
}

function pov(id: string, text: string, generatedAt = "2026-06-01T10:00:00Z") {
  return {
    session_id: SESSION_ID,
    pj_id: id,
    text,
    model_used: "claude-x",
    generated_at: generatedAt,
  };
}

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function responseProblem(status: number, title: string) {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status }),
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function stub(opts: {
  declared?: string[];
  roster?: ReturnType<typeof pj>[];
  povs?: Record<string, ReturnType<typeof pov> | null>;
  generated?: boolean;
  jobStatus?: "queued" | "running" | "succeeded" | "failed";
  failureReason?: string | null;
  playersStatus?: number;
  povStatus?: number;
} = {}) {
  const declared = opts.declared ?? [];
  const roster =
    opts.roster ?? declared.map((id, index) => pj(id, `PJ ${index + 1}`));
  let generated = Boolean(opts.generated);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const method = typeof input === "string" ? "GET" : (input.method ?? "GET");
      const isPost = method.toUpperCase() === "POST";

      if (url.includes(`/sessions/${SESSION_ID}/players`)) {
        if (opts.playersStatus && opts.playersStatus >= 400) {
          return responseProblem(opts.playersStatus, "players error");
        }
        return responseJson({
          session_id: SESSION_ID,
          pj_ids: declared,
          updated_at: "2026-06-01T10:00:00Z",
        });
      }

      if (url.includes("/services/jdr/pjs")) {
        return responseJson({
          items: roster,
          page: 1,
          size: 50,
          total: roster.length,
        });
      }

      if (url.includes("/artifacts/povs") && isPost) {
        generated = true;
        return responseJson(
          {
            id: "job-pov",
            kind: "povs",
            session_id: SESSION_ID,
            status: "queued",
            queued_at: "2026-06-01T10:00:00Z",
          },
          202,
        );
      }

      if (url.includes("/artifacts/povs/")) {
        if (opts.povStatus && opts.povStatus >= 400) {
          return responseProblem(opts.povStatus, "pov absent");
        }
        const pjId = decodeURIComponent(
          url.split("/artifacts/povs/")[1]?.split(/[?#]/)[0] ?? "",
        );
        const configured =
          opts.povs && Object.hasOwn(opts.povs, pjId)
            ? opts.povs[pjId]
            : undefined;
        const body =
          configured ??
          (generated ? pov(pjId, `POV genere pour ${pjId}.`) : null);
        return responseJson(body);
      }

      if (url.includes("/jobs/job-pov")) {
        return responseJson({
          id: "job-pov",
          kind: "povs",
          session_id: SESSION_ID,
          status: opts.jobStatus ?? "succeeded",
          failure_reason: opts.failureReason ?? null,
          queued_at: "2026-06-01T10:00:00Z",
          started_at: "2026-06-01T10:00:01Z",
          ended_at: null,
        });
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

function postPovCalls() {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  return fetchMock.mock.calls.filter((args) => {
    const request = args[0] as Request;
    return request.url.includes("/artifacts/povs") && request.method === "POST";
  });
}

beforeEach(() => {
  toastErrorMock.mockClear();
  window.history.replaceState(null, "", "/sessions/test?sub=povs");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<PovArtifactPanel> (Story 5.7)", () => {
  test("no declared PJ -> disabled trigger with the canonical empty state", async () => {
    stub({ declared: [] });
    renderPanel();
    const button = await screen.findByRole("button", { name: /POVs/i });
    expect(button).toBeDisabled();
    expect(
      await screen.findByText(/Aucun PJ declar|Aucun PJ d/i),
    ).toBeInTheDocument();
  });

  test("players GET error keeps the trigger disabled with an explicit error", async () => {
    stub({ playersStatus: 500 });
    renderPanel();
    const button = await screen.findByRole("button", { name: /POVs/i });
    expect(button).toBeDisabled();
    expect(
      await screen.findByText(/Impossible de v/i),
    ).toBeInTheDocument();
  });

  test("declared PJ + 200 null POV -> first-generation trigger remains enabled", async () => {
    stub({ declared: [PJ_1], roster: [pj(PJ_1, "Mira")] });
    renderPanel();
    const button = await screen.findByRole("button", { name: /POVs/i });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByRole("tab", { name: "Mira" })).not.toBeInTheDocument();
  });

  test("generated POVs render one PJ tab per declared roster PJ", async () => {
    stub({
      declared: [PJ_1, PJ_2, "deleted-pj"],
      roster: [pj(PJ_1, "Mira"), pj(PJ_2, "Nox")],
      povs: {
        [PJ_1]: pov(PJ_1, "Mira lit les cendres."),
        [PJ_2]: pov(PJ_2, "Nox entend les cloches."),
      },
    });
    renderPanel();

    expect(await screen.findByRole("tab", { name: "Mira" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Nox" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /deleted/i })).not.toBeInTheDocument();
    expect(screen.getByText("Mira lit les cendres.")).toBeInTheDocument();
    expect(screen.getByText(/claude-x/)).toBeInTheDocument();
  });

  test("clicking another PJ fetches its POV, renders it, and persists ?sub=povs&pj=", async () => {
    stub({
      declared: [PJ_1, PJ_2],
      roster: [pj(PJ_1, "Mira"), pj(PJ_2, "Nox")],
      povs: {
        [PJ_1]: pov(PJ_1, "Mira lit les cendres."),
        [PJ_2]: pov(PJ_2, "Nox entend les cloches."),
      },
    });
    renderPanel();
    const user = userEvent.setup();

    await screen.findByText("Mira lit les cendres.");
    await user.click(screen.getByRole("tab", { name: "Nox" }));

    expect(await screen.findByText("Nox entend les cloches.")).toBeInTheDocument();
    expect(window.location.search).toBe(`?sub=povs&pj=${PJ_2}`);

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const fetchedPj2 = fetchMock.mock.calls.some((args) => {
      const request = args[0] as Request;
      return request.url.includes(`/artifacts/povs/${PJ_2}`);
    });
    expect(fetchedPj2).toBe(true);
  });

  test("invalid deep-link ?pj falls back silently to the first declared roster PJ", async () => {
    window.history.replaceState(null, "", "/sessions/test?sub=povs&pj=missing");
    stub({
      declared: [PJ_1, PJ_2],
      roster: [pj(PJ_1, "Mira"), pj(PJ_2, "Nox")],
      povs: {
        [PJ_1]: pov(PJ_1, "Mira lit les cendres."),
        [PJ_2]: pov(PJ_2, "Nox entend les cloches."),
      },
    });
    renderPanel();

    expect(await screen.findByText("Mira lit les cendres.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mira" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("clicking first-generation POSTs /artifacts/povs and refreshes into reading mode", async () => {
    stub({ declared: [PJ_1], roster: [pj(PJ_1, "Mira")], jobStatus: "succeeded" });
    renderPanel();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: /POVs/i });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(
      await screen.findByText(/POV genere pour pj-1/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(postPovCalls()).toHaveLength(1);
  });

  test("regenerate -> confirm -> second POST /artifacts/povs", async () => {
    stub({
      declared: [PJ_1],
      roster: [pj(PJ_1, "Mira")],
      generated: true,
      jobStatus: "succeeded",
    });
    renderPanel();
    const user = userEvent.setup();

    expect(await screen.findByText(/POV genere pour pj-1/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /POVs/i }));
    await user.click(screen.getByRole("button", { name: /g.*n.*rer/i }));

    await waitFor(() => expect(postPovCalls()).toHaveLength(1));
  });

  test("failed first generation surfaces the failure reason inline + toast, with a retry", async () => {
    stub({
      declared: [PJ_1],
      roster: [pj(PJ_1, "Mira")],
      jobStatus: "failed",
      failureReason: "LLM provider unreachable",
    });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /POVs/i }));
    expect(
      await screen.findByText(/LLM provider unreachable/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("LLM provider unreachable"),
    );

    await user.click(screen.getByRole("button", { name: /essayer/i }));
    await waitFor(() => expect(postPovCalls()).toHaveLength(2));
  });

  test("failed regeneration keeps the manuscript visible and retry behind confirm", async () => {
    stub({
      declared: [PJ_1],
      roster: [pj(PJ_1, "Mira")],
      generated: true,
      jobStatus: "failed",
      failureReason: "LLM error",
    });
    renderPanel();
    const user = userEvent.setup();

    expect(await screen.findByText(/POV genere pour pj-1/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /POVs/i }));
    await user.click(screen.getByRole("button", { name: /g.*n.*rer/i }));

    expect(
      await screen.findByText(/LLM error/i, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/POV genere pour pj-1/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /POVs/i }));
    await user.click(screen.getByRole("button", { name: /g.*n.*rer/i }));
    await waitFor(() => expect(postPovCalls()).toHaveLength(2));
  });
});
