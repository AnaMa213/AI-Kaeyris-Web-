// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
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

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const sessionIdFixture = "00000000-0000-0000-0000-000000000abc";
const campId = "11111111-1111-1111-1111-111111111111";

vi.mock("next/navigation", () => ({
  useParams: () => ({ campId, sid: sessionIdFixture }),
}));

const { default: SessionDetailPage } = await import(
  "@/app/(jdr)/jdr/campaigns/[campId]/sessions/[sid]/page"
);

const baseSession = {
  id: sessionIdFixture,
  title: "Session 7 — La crypte oubliée",
  recorded_at: "2026-05-30T18:00:00",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-31T18:05:00",
  updated_at: "2026-05-31T18:05:00",
};

const baseCampaign = {
  id: campId,
  name: "Campagne par défaut",
  description: null,
  role: "gm",
  session_count: 1,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SessionDetailPage />
    </QueryClientProvider>,
  );
  return queryClient;
};

function stubFetch(opts: {
  session?: typeof baseSession;
  sessionStatus?: number;
  campaign?: typeof baseCampaign;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes(`/services/jdr/campaigns/${campId}`)) {
        return new Response(
          JSON.stringify(opts.campaign ?? baseCampaign),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
        if (opts.sessionStatus && opts.sessionStatus >= 400) {
          return new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Not Found",
              status: opts.sessionStatus,
            }),
            {
              status: opts.sessionStatus,
              headers: { "content-type": "application/problem+json" },
            },
          );
        }
        return new Response(JSON.stringify(opts.session ?? baseSession), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 200 });
    }),
  );
}

describe("/jdr/campaigns/[campId]/sessions/[sid] page", () => {
  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  test("renders the session title + state badge once fetched", async () => {
    stubFetch({});
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Session 7 — La crypte oubliée",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Créée")).toBeInTheDocument();
  });

  test("renders the SessionAudioUploadCard dropzone for a GM on a session in 'created' state (Story 3.1)", async () => {
    stubFetch({});
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.getByRole("button", { name: /Glisse ton M4A/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Uploader l'audio de la séance" }),
    ).not.toBeInTheDocument();
  });

  test("does NOT render the dropzone for a PJ on a session in 'created' state (Story 3.1)", async () => {
    stubFetch({ campaign: { ...baseCampaign, role: "pj" } });
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("button", { name: /Glisse ton M4A/ }),
    ).not.toBeInTheDocument();
  });

  test("swaps to the 'Lire l'audio' (disabled) CTA once state >= audio_uploaded, hides the dropzone", async () => {
    stubFetch({ session: { ...baseSession, state: "audio_uploaded" } });
    renderPage();
    const playCta = await screen.findByRole("button", {
      name: "Lire l'audio de la séance",
    });
    expect(playCta).toBeDisabled();
    expect(playCta.getAttribute("title")).toMatch(/Epic 3/);
    expect(
      screen.queryByRole("button", { name: /Glisse ton M4A/ }),
    ).not.toBeInTheDocument();
  });

  test("renders the CampaignBreadcrumb link to the parent campaign", async () => {
    stubFetch({});
    renderPage();
    const breadcrumbLink = await screen.findByRole("link", {
      name: /Campagne par défaut/,
    });
    expect(breadcrumbLink).toHaveAttribute(
      "href",
      `/jdr/campaigns/${campId}`,
    );
  });

  test("never exposes the session UUID anywhere in the visible DOM text", async () => {
    stubFetch({});
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(sessionIdFixture)).not.toBeInTheDocument();
  });

  test("parses naive backend recorded_at as UTC (regression guard for BD-5 TZ bug)", async () => {
    stubFetch({});
    renderPage();
    const timeEl = await screen.findByText(
      (_, node) => node?.tagName.toLowerCase() === "time",
    );
    expect(timeEl.getAttribute("datetime")).toBe("2026-05-30T18:00:00");
  });

  test("surfaces 'Session introuvable.' on session error", async () => {
    stubFetch({ sessionStatus: 404 });
    renderPage();
    expect(
      await screen.findByText("Session introuvable."),
    ).toBeInTheDocument();
  });

  test("renders the Modifier button when the campaign role is gm (Story 2.8)", async () => {
    stubFetch({});
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Modifier" }),
    ).toBeInTheDocument();
  });

  test("does NOT render the Modifier button when the campaign role is pj (Story 2.8)", async () => {
    stubFetch({ campaign: { ...baseCampaign, role: "pj" } });
    renderPage();
    // Wait for the page to settle (h1 rendered)
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("button", { name: "Modifier" }),
    ).not.toBeInTheDocument();
  });

  test("after upload success the JobStateBadge 'En file' appears in the header (Story 3.3)", async () => {
    const audioResponse = {
      session_id: sessionIdFixture,
      path: "data/audio/x.m4a",
      sha256: "a".repeat(64),
      size_bytes: 1024,
      duration_seconds: null,
      uploaded_at: "2026-05-31T19:00:00+00:00",
      job_id: "job-uuid-3-3",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (url.includes(`/services/jdr/campaigns/${campId}`)) {
          return new Response(JSON.stringify(baseCampaign), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (
          url.includes(`/services/jdr/sessions/${sessionIdFixture}/audio`) &&
          method?.toUpperCase() === "POST"
        ) {
          return new Response(JSON.stringify(audioResponse), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        // Live polling (Story 3.4): keep the job queued so the badge stays "En file".
        if (url.includes(`/services/jdr/jobs/${audioResponse.job_id}`)) {
          return new Response(
            JSON.stringify({
              id: audioResponse.job_id,
              kind: "transcription",
              session_id: sessionIdFixture,
              status: "queued",
              failure_reason: null,
              queued_at: audioResponse.uploaded_at,
              started_at: null,
              ended_at: null,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
          return new Response(JSON.stringify(baseSession), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1 });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [new File(["x"], "demo.m4a", { type: "audio/mp4" })],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    await screen.findByText("Le parchemin se prépare");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(
      await screen.findByLabelText("État de la transcription : En file"),
    ).toBeInTheDocument();
  });

  test("fires a single success toast when the polled job reaches 'succeeded' (Story 3.4)", async () => {
    toastSuccessMock.mockClear();
    const recentUploadedAt = new Date().toISOString();
    const audioResponse = {
      session_id: sessionIdFixture,
      path: "data/audio/x.m4a",
      sha256: "a".repeat(64),
      size_bytes: 1024,
      duration_seconds: 600,
      uploaded_at: recentUploadedAt,
      job_id: "job-uuid-3-4",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        const method =
          typeof input === "string" ? init?.method : (input.method ?? "GET");
        if (url.includes(`/services/jdr/campaigns/${campId}`)) {
          return new Response(JSON.stringify(baseCampaign), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (
          url.includes(`/services/jdr/sessions/${sessionIdFixture}/audio`) &&
          method?.toUpperCase() === "POST"
        ) {
          return new Response(JSON.stringify(audioResponse), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        // The live poll returns a terminal succeeded job.
        if (url.includes(`/services/jdr/jobs/${audioResponse.job_id}`)) {
          return new Response(
            JSON.stringify({
              id: audioResponse.job_id,
              kind: "transcription",
              session_id: sessionIdFixture,
              status: "succeeded",
              failure_reason: null,
              queued_at: recentUploadedAt,
              started_at: recentUploadedAt,
              ended_at: recentUploadedAt,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
          return new Response(JSON.stringify(baseSession), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1 });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [new File(["x"], "demo.m4a", { type: "audio/mp4" })],
      configurable: true,
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    await screen.findByText("Le parchemin se prépare");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(
      () => {
        expect(toastSuccessMock).toHaveBeenCalledWith(
          "Transcription terminée — ton récit est consigné.",
        );
      },
      { timeout: 4000 },
    );
    // Dedup: the terminal toast fires exactly once even as polling settles.
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
  });

  test("renders the RitualProgress transcribing act when the session is 'transcribing' (Story 3.3.1)", async () => {
    stubFetch({ session: { ...baseSession, state: "transcribing" } });
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(
      await screen.findByText("Les scribes transcrivent"),
    ).toBeInTheDocument();
    // The created-state dropzone is gone.
    expect(
      screen.queryByRole("button", { name: /Glisse ton M4A/ }),
    ).not.toBeInTheDocument();
  });

  test("clicking Modifier opens the SessionEditDialog (Story 2.8)", async () => {
    stubFetch({});
    const user = userEvent.setup();
    renderPage();
    const editButton = await screen.findByRole("button", { name: "Modifier" });
    await user.click(editButton);
    expect(
      await screen.findByRole("heading", { name: "Modifier la session" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titre")).toBeInTheDocument();
  });
});
