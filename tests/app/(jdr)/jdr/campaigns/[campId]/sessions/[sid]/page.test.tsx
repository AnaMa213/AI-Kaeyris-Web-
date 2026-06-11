// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
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
const currentPathname = `/jdr/campaigns/${campId}/sessions/${sessionIdFixture}`;
const seenKey = `kaeyris:jdr:session-transcription-seen:${sessionIdFixture}`;
const toastSeenKey = `kaeyris:jdr:session-transcription-toast-seen:${sessionIdFixture}`;

vi.mock("next/navigation", () => ({
  useParams: () => ({ campId, sid: sessionIdFixture }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const { default: SessionDetailPage } =
  await import("@/app/(jdr)/jdr/campaigns/[campId]/sessions/[sid]/page");

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
  const result = render(
    <QueryClientProvider client={queryClient}>
      <SessionDetailPage />
    </QueryClientProvider>,
  );
  return { queryClient, ...result };
};

function stubFetch(opts: {
  session?: typeof baseSession;
  sessionStatus?: number;
  campaign?: typeof baseCampaign;
  // Story 4.13 — transcription viewer fixtures (only fetched at `transcribed`).
  chunks?: Array<{ chunk_id: string; ordre: number; text: string }>;
  segments?: Array<{
    speaker_label: string;
    text: string;
    start_seconds: number;
    end_seconds: number;
  }>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes(`/services/jdr/campaigns/${campId}`)) {
        return new Response(JSON.stringify(opts.campaign ?? baseCampaign), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // `/chunks` and `/transcription` are sub-paths of the session URL — match
      // them BEFORE the generic session matcher below, or they'd return a
      // SessionOut instead of the transcription payload.
      if (url.includes(`/services/jdr/sessions/${sessionIdFixture}/chunks`)) {
        return new Response(
          JSON.stringify({
            session_id: sessionIdFixture,
            items: opts.chunks ?? [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (
        url.includes(`/services/jdr/sessions/${sessionIdFixture}/transcription`)
      ) {
        return new Response(
          JSON.stringify({
            session_id: sessionIdFixture,
            language: "fr",
            model_used: "whisper-x",
            provider: "mock",
            completed_at: "2026-06-01T10:00:00Z",
            segments: opts.segments ?? [],
          }),
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
  beforeEach(() => {
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    window.localStorage.clear();
    window.history.replaceState(null, "", currentPathname);
  });

  test("renders the FantasyLoader while pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
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
    expect(breadcrumbLink).toHaveAttribute("href", `/jdr/campaigns/${campId}`);
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
    expect(await screen.findByText("Session introuvable.")).toBeInTheDocument();
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
    let audioUploaded = false;

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
          audioUploaded = true;
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
          // BD-8: avant POST audio la session est `created` (dropzone visible) ;
          // après, refetch renvoie l'état post-upload avec `current_job_id`.
          const sessionPayload = audioUploaded
            ? {
                ...baseSession,
                state: "audio_uploaded",
                current_job_id: audioResponse.job_id,
              }
            : baseSession;
          return new Response(JSON.stringify(sessionPayload), {
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

    // Le rituel ne s'affiche plus avant l'envoi : on confirme d'abord le fichier.
    await screen.findByText("demo.m4a");
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
    let audioUploaded = false;

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
          audioUploaded = true;
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
          // BD-8: avant POST audio la session est `created` (dropzone visible) ;
          // après, refetch renvoie l'état post-upload avec `current_job_id`.
          const sessionPayload = audioUploaded
            ? {
                ...baseSession,
                state: "transcribing",
                current_job_id: audioResponse.job_id,
              }
            : baseSession;
          return new Response(JSON.stringify(sessionPayload), {
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

    // Le rituel ne s'affiche plus avant l'envoi : on confirme d'abord le fichier.
    await screen.findByText("demo.m4a");
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

  test("resumes job polling after refresh when SessionOut exposes current_job_id (Story 3.4 / BD-8)", async () => {
    const resumedJobId = "job-uuid-refresh";
    const sessionFixture = {
      ...baseSession,
      state: "transcribing" as const,
      current_job_id: resumedJobId,
    };

    let jobFetchCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.includes(`/services/jdr/campaigns/${campId}`)) {
          return new Response(JSON.stringify(baseCampaign), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.includes(`/services/jdr/jobs/${resumedJobId}`)) {
          jobFetchCount += 1;
          return new Response(
            JSON.stringify({
              id: resumedJobId,
              kind: "transcription",
              session_id: sessionIdFixture,
              status: "running",
              failure_reason: null,
              queued_at: "2026-05-31T19:00:00+00:00",
              started_at: "2026-05-31T19:00:05+00:00",
              ended_at: null,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
          return new Response(JSON.stringify(sessionFixture), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderPage();
    // Le badge polled apparaît sans aucune interaction : preuve que le polling
    // s'arme depuis `session.current_job_id` au lieu d'un useState perdu au reload.
    expect(
      await screen.findByLabelText(
        "État de la transcription : Transcription en cours",
      ),
    ).toBeInTheDocument();
    expect(jobFetchCount).toBeGreaterThan(0);
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

  describe("Story 3.5 — Replace audio affordance", () => {
    test("offers 'Remplacer l'enregistrement' on audio_uploaded", async () => {
      stubFetch({ session: { ...baseSession, state: "audio_uploaded" } });
      renderPage();
      await screen.findByRole("heading", { level: 1 });
      expect(
        await screen.findByRole("button", {
          name: "Remplacer l'enregistrement",
        }),
      ).toBeInTheDocument();
    });

    test("offers an enabled 'Remplacer l'enregistrement' on transcription_failed", async () => {
      stubFetch({ session: { ...baseSession, state: "transcription_failed" } });
      renderPage();
      await screen.findByText("Le grimoire est resté muet");
      const replace = screen.getByRole("button", {
        name: "Remplacer l'enregistrement",
      });
      expect(replace).toBeEnabled();
      // The retry button stays inert (no re-transcribe endpoint in V1).
      expect(
        screen.getByRole("button", { name: "Relancer la transcription" }),
      ).toBeDisabled();
    });

    test("hides the replace affordance while transcribing (locked)", async () => {
      stubFetch({ session: { ...baseSession, state: "transcribing" } });
      renderPage();
      await screen.findByText("Les scribes transcrivent");
      expect(
        screen.queryByRole("button", { name: "Remplacer l'enregistrement" }),
      ).not.toBeInTheDocument();
    });

    test("hides the replace affordance once transcribed (locked)", async () => {
      stubFetch({ session: { ...baseSession, state: "transcribed" } });
      renderPage();
      await screen.findByText("Le récit est consigné");
      expect(
        screen.queryByRole("button", { name: "Remplacer l'enregistrement" }),
      ).not.toBeInTheDocument();
    });

    // Regression (code-review #1): the replace affordance is gated on the
    // displayed act (ritualState), not the raw cached session.state. A session
    // stuck at audio_uploaded in cache while the live job poll has gone terminal
    // must NOT show a replace CTA over the success act, nor duplicate it on fail.
    function stubWithPolledJob(jobStatus: "succeeded" | "failed") {
      const jobId = "job-terminal-poll";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            return new Response(
              JSON.stringify({
                id: jobId,
                kind: "transcription",
                session_id: sessionIdFixture,
                status: jobStatus,
                failure_reason: jobStatus === "failed" ? "boom" : null,
                queued_at: "2026-05-31T19:00:00+00:00",
                started_at: "2026-05-31T19:00:05+00:00",
                ended_at: "2026-05-31T19:01:00+00:00",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: "audio_uploaded",
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("no replace CTA over the success act when the polled job succeeded (session cache stale at audio_uploaded)", async () => {
      stubWithPolledJob("succeeded");
      renderPage();
      expect(
        await screen.findByText("Le récit est consigné"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Remplacer l'enregistrement" }),
      ).not.toBeInTheDocument();
    });

    test("exactly one replace CTA when the polled job failed (no duplicate with the external button)", async () => {
      stubWithPolledJob("failed");
      renderPage();
      await screen.findByText("Le grimoire est resté muet");
      expect(
        screen.getAllByRole("button", { name: "Remplacer l'enregistrement" }),
      ).toHaveLength(1);
    });

    test("clicking 'Remplacer' reveals the replace dropzone and hides the ritual", async () => {
      stubFetch({ session: { ...baseSession, state: "audio_uploaded" } });
      const user = userEvent.setup();
      renderPage();
      await user.click(
        await screen.findByRole("button", {
          name: "Remplacer l'enregistrement",
        }),
      );
      expect(
        await screen.findByRole("button", { name: /Glisse ton M4A/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Les scribes transcrivent"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Story 4.15 — guard against concurrent transcriptions (T2)", () => {
    const REPLACE_BLOCKED_HINT =
      "Transcription en cours — patiente avant de remplacer l'enregistrement.";

    // audio_uploaded + a NON-terminal polled job → a transcription is genuinely
    // active. The replace trigger must be disabled (with the hint), not removed,
    // so the GM cannot launch a second concurrent transcription.
    function stubWithActiveJob(jobStatus: "queued" | "running") {
      const jobId = "job-active-guard";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            return new Response(
              JSON.stringify({
                id: jobId,
                kind: "transcription",
                session_id: sessionIdFixture,
                status: jobStatus,
                failure_reason: null,
                queued_at: new Date().toISOString(),
                started_at: jobStatus === "running" ? new Date().toISOString() : null,
                ended_at: null,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: "audio_uploaded",
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("disables the replace trigger (with a hint) while a job is active", async () => {
      stubWithActiveJob("running");
      renderPage();
      await screen.findByText("Les scribes transcrivent");
      const replace = await screen.findByRole("button", {
        name: "Remplacer l'enregistrement",
      });
      expect(replace).toBeDisabled();
      expect(replace).toHaveAttribute("title", REPLACE_BLOCKED_HINT);
    });

    test("a disabled replace trigger does not open the replace dropzone", async () => {
      stubWithActiveJob("queued");
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Les scribes transcrivent");
      await user.click(
        screen.getByRole("button", { name: "Remplacer l'enregistrement" }),
      );
      expect(
        screen.queryByRole("button", { name: /Glisse ton M4A/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Story 4.13 — Transcription viewer", () => {
    test("renders the stitched chunks for a transcribed non_diarised session", async () => {
      stubFetch({
        session: {
          ...baseSession,
          state: "transcribed",
          transcription_mode: "non_diarised",
        },
        chunks: [{ chunk_id: "c1", ordre: 1, text: "Le héros entre dans la crypte." }],
      });
      renderPage();
      expect(
        await screen.findByText("Le héros entre dans la crypte."),
      ).toBeInTheDocument();
    });

    test("renders diarised segments with speaker labels for a transcribed diarised session", async () => {
      stubFetch({
        session: {
          ...baseSession,
          state: "transcribed",
          transcription_mode: "diarised",
        },
        segments: [
          {
            speaker_label: "speaker_1",
            text: "Salutations, aventuriers.",
            start_seconds: 0,
            end_seconds: 2,
          },
        ],
      });
      renderPage();
      expect(
        await screen.findByText("Salutations, aventuriers."),
      ).toBeInTheDocument();
      expect(screen.getByText("speaker_1")).toBeInTheDocument();
    });
  });

  describe("Story 3.6 — Live phases & real progress (BD-10)", () => {
    function stubWithLiveJob(job: {
      status: string;
      phase?: string | null;
      progress_percent?: number | null;
    }) {
      const jobId = "job-bd10";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            return new Response(
              JSON.stringify({
                id: jobId,
                kind: "transcription",
                session_id: sessionIdFixture,
                status: job.status,
                phase: job.phase ?? null,
                progress_percent: job.progress_percent ?? null,
                failure_reason: null,
                queued_at: "2026-05-31T19:00:00+00:00",
                started_at: "2026-05-31T19:00:05+00:00",
                ended_at: null,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: "transcribing",
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("drives the determinate bar from the real progress_percent", async () => {
      stubWithLiveJob({
        status: "running",
        phase: "transcribing",
        progress_percent: 40,
      });
      renderPage();
      const bar = await screen.findByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "40");
      expect(screen.getByText("Les scribes transcrivent")).toBeInTheDocument();
    });

    test("phase 'reducing' shows the preparation habillage", async () => {
      stubWithLiveJob({
        status: "running",
        phase: "reducing",
        progress_percent: 5,
      });
      renderPage();
      expect(
        await screen.findByText("Le grimoire se prépare"),
      ).toBeInTheDocument();
    });
  });

  describe("Story 4.1 — Declare PJ presence", () => {
    function stubFor(opts: { state: string; role?: "gm" | "pj" }) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes("/services/jdr/pjs")) {
            return new Response(
              JSON.stringify({
                items: [
                  {
                    id: "pj-1",
                    name: "Eldrin",
                    campaign_id: campId,
                    created_at: "2026-05-30T10:00:00Z",
                  },
                ],
                total: 1,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(
              JSON.stringify({ ...baseCampaign, role: opts.role ?? "gm" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/sessions/${sessionIdFixture}/players`)) {
            return new Response(
              JSON.stringify({
                session_id: sessionIdFixture,
                pj_ids: [],
                updated_at: "2026-06-01T10:00:00Z",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({ ...baseSession, state: opts.state }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("shows the presence dropdown for a GM on a transcribed session", async () => {
      window.localStorage.setItem(seenKey, "1");
      window.history.replaceState(
        null,
        "",
        `${currentPathname}?tab=artefacts&sub=summary`,
      );
      stubFor({ state: "transcribed", role: "gm" });
      renderPage();
      // Story 4.7 (S6): the presence card became a compact dropdown trigger.
      expect(
        await screen.findByRole("button", { name: /Qui était présent/i }),
      ).toBeInTheDocument();
    });

    test("hides the presence control for a PJ", async () => {
      stubFor({ state: "transcribed", role: "pj" });
      renderPage();
      await screen.findByRole("tab", { name: "Artefacts" });
      expect(
        screen.queryByRole("button", { name: /Qui était présent/i }),
      ).not.toBeInTheDocument();
    });

    test("hides the presence control while still transcribing", async () => {
      stubFor({ state: "transcribing", role: "gm" });
      renderPage();
      await screen.findByText("Les scribes transcrivent");
      expect(
        screen.queryByRole("button", { name: /Qui était présent/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Story 4.2 - Tabbed session page", () => {
    function stubForTabs(opts: { state: string; role?: "gm" | "pj" }) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes("/services/jdr/pjs")) {
            return new Response(
              JSON.stringify({
                items: [
                  {
                    id: "pj-1",
                    name: "Eldrin",
                    campaign_id: campId,
                    created_at: "2026-05-30T10:00:00Z",
                  },
                ],
                total: 1,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(
              JSON.stringify({ ...baseCampaign, role: opts.role ?? "gm" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/sessions/${sessionIdFixture}/players`)) {
            return new Response(
              JSON.stringify({
                session_id: sessionIdFixture,
                pj_ids: [],
                updated_at: "2026-06-01T10:00:00Z",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({ ...baseSession, state: opts.state }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("renders top tabs and defaults an unfinished session to Transcription", async () => {
      stubForTabs({ state: "created", role: "gm" });
      renderPage();

      const transcriptionTab = await screen.findByRole("tab", {
        name: "Transcription",
      });
      expect(transcriptionTab).toHaveAttribute("aria-selected", "true");
      expect(transcriptionTab.className).toContain("after:bg-accent-gold");
      expect(
        screen.getByRole("tab", { name: "Artefacts" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Glisse ton M4A/ }),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(window.location.search).toBe("?tab=transcription");
      });
    });

    test("clicking Artefacts writes tab and sub in the URL while preserving other params", async () => {
      window.history.replaceState(null, "", `${currentPathname}?ritual=failed`);
      stubForTabs({ state: "transcribed", role: "gm" });
      const user = userEvent.setup();
      renderPage();

      await screen.findByRole("tab", { name: "Transcription" });
      await user.click(screen.getByRole("tab", { name: "Artefacts" }));

      await waitFor(() => {
        expect(window.location.search).toContain("ritual=failed");
        expect(window.location.search).toContain("tab=artefacts");
        expect(window.location.search).toContain("sub=summary");
      });
      expect(
        await screen.findByRole("button", { name: /Qui était présent/i }),
      ).toBeInTheDocument();
    });

    test("disabled artifact sub-tabs expose the required tooltip copy", async () => {
      window.localStorage.setItem(seenKey, "1");
      window.history.replaceState(
        null,
        "",
        `${currentPathname}?tab=artefacts&sub=summary`,
      );
      stubForTabs({ state: "transcribed", role: "gm" });
      renderPage();

      expect(
        await screen.findByRole("tab", { name: "Résumé" }),
      ).toHaveAttribute("aria-selected", "true");
      for (const name of ["Récit", "Éléments", "POVs"]) {
        const tab = screen.getByRole("tab", { name });
        expect(tab).toHaveAttribute("aria-disabled", "true");
        expect(tab).toHaveAttribute("title", "Génère cet artefact d'abord");
      }
    });

    test("auto-opens the completed transcription only once per session", async () => {
      stubForTabs({ state: "transcribed", role: "gm" });
      const firstVisit = renderPage();

      expect(
        await screen.findByRole("tab", { name: "Transcription" }),
      ).toHaveAttribute("aria-selected", "true");
      await waitFor(() => {
        expect(window.localStorage.getItem(seenKey)).toBe("1");
        expect(window.location.search).toBe("?tab=transcription");
      });

      firstVisit.unmount();
      window.history.replaceState(null, "", currentPathname);
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Artefacts" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        expect(window.location.search).toBe("?tab=artefacts&sub=summary");
      });
    });
  });

  describe("Story 4.3 - Trigger Summary generation", () => {
    function stubForSummary(opts: { summary?: boolean; declared?: string[] }) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          const method =
            typeof input === "string" ? "GET" : (input.method ?? "GET");
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes("/services/jdr/pjs")) {
            return new Response(
              JSON.stringify({ items: [{ id: "pj-1", name: "Eldrin", campaign_id: campId, created_at: "2026-05-30T10:00:00Z" }], total: 1 }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/sessions/${sessionIdFixture}/players`)) {
            return new Response(
              JSON.stringify({ session_id: sessionIdFixture, pj_ids: opts.declared ?? [], updated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary") && method.toUpperCase() === "GET") {
            if (!opts.summary) {
              return new Response(JSON.stringify({ type: "about:blank", title: "absent", status: 404 }), {
                status: 404,
                headers: { "content-type": "application/problem+json" },
              });
            }
            return new Response(
              JSON.stringify({ session_id: sessionIdFixture, text: "Résumé de la séance.", model_used: "claude-x", generated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({ ...baseSession, state: "transcribed" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    function gotoArtefacts() {
      window.localStorage.setItem(seenKey, "1");
      window.history.replaceState(null, "", `${currentPathname}?tab=artefacts&sub=summary`);
    }

    test("keeps Récit/Éléments/POVs disabled while no summary exists", async () => {
      gotoArtefacts();
      stubForSummary({ summary: false, declared: ["pj-1"] });
      renderPage();
      await screen.findByRole("tab", { name: "Résumé" });
      for (const name of ["Récit", "Éléments", "POVs"]) {
        expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-disabled", "true");
      }
    });

    test("enables the 3 sub-tabs once a summary exists", async () => {
      gotoArtefacts();
      stubForSummary({ summary: true, declared: ["pj-1"] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Récit" })).not.toHaveAttribute("aria-disabled", "true");
      });
      expect(screen.getByRole("tab", { name: "Éléments" })).not.toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("tab", { name: "POVs" })).not.toHaveAttribute("aria-disabled", "true");
    });

    test("shows the 'Générer le Résumé' trigger for a GM with a declared PJ", async () => {
      gotoArtefacts();
      stubForSummary({ summary: false, declared: ["pj-1"] });
      renderPage();
      expect(
        await screen.findByRole("button", { name: /Générer le Résumé/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Story 4.4 - Trigger derived artifacts", () => {
    // Summary present → the 3 sub-tabs are unlocked; narrative/elements are
    // absent (404) so each pane shows its generation trigger (no placeholder).
    function stubFor44(opts: { declared?: string[]; summary?: boolean }) {
      const summaryPresent = opts.summary ?? true;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          const method =
            typeof input === "string" ? "GET" : (input.method ?? "GET");
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes("/services/jdr/pjs")) {
            return new Response(
              JSON.stringify({ items: [{ id: "pj-1", name: "Eldrin", campaign_id: campId, created_at: "2026-05-30T10:00:00Z" }], total: 1 }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/sessions/${sessionIdFixture}/players`)) {
            return new Response(
              JSON.stringify({ session_id: sessionIdFixture, pj_ids: opts.declared ?? [], updated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary")) {
            if (!summaryPresent) {
              return new Response(
                JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
                { status: 404, headers: { "content-type": "application/problem+json" } },
              );
            }
            return new Response(
              JSON.stringify({ session_id: sessionIdFixture, text: "Résumé de la séance.", model_used: "claude-x", generated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          // Récit / Éléments absents → 404 (l'UI les traite comme « à générer »).
          if (
            (url.includes("/artifacts/narrative") ||
              url.includes("/artifacts/elements")) &&
            method.toUpperCase() === "GET"
          ) {
            return new Response(
              JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
              { status: 404, headers: { "content-type": "application/problem+json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({ ...baseSession, state: "transcribed" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    function gotoSub(sub: string) {
      window.localStorage.setItem(seenKey, "1");
      window.history.replaceState(
        null,
        "",
        `${currentPathname}?tab=artefacts&sub=${sub}`,
      );
    }

    test("Récit sub-tab renders the 'Générer le Récit' trigger (not a placeholder)", async () => {
      gotoSub("narrative");
      stubFor44({ declared: ["pj-1"] });
      renderPage();
      expect(
        await screen.findByRole("button", { name: /Générer le Récit/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("La génération de cet artefact arrive prochainement."),
      ).not.toBeInTheDocument();
    });

    test("Éléments sub-tab renders the 'Générer les Éléments' trigger", async () => {
      gotoSub("elements");
      stubFor44({ declared: ["pj-1"] });
      renderPage();
      expect(
        await screen.findByRole("button", { name: /Générer les Éléments/i }),
      ).toBeInTheDocument();
    });

    test("POVs sub-tab renders an enabled 'Générer les POVs' trigger with a declared PJ", async () => {
      gotoSub("povs");
      stubFor44({ declared: ["pj-1"] });
      renderPage();
      const button = await screen.findByRole("button", {
        name: /Générer les POVs/i,
      });
      await waitFor(() => expect(button).toBeEnabled());
    });

    // AC3 guard: a deep-link to a derived sub-tab with NO summary must not mount
    // the trigger (no POST → 409 no-summary impossible).
    test("deep-linking sub=narrative without a summary shows no trigger (read-only placeholder)", async () => {
      gotoSub("narrative");
      stubFor44({ declared: ["pj-1"], summary: false });
      renderPage();
      expect(
        await screen.findByText(
          "Les artefacts de cette séance seront publiés ici.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Générer le Récit/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Story 4.7 — One-shot completion toast (S4)", () => {
    function stubSucceededJob() {
      const recentUploadedAt = new Date().toISOString();
      const jobId = "job-4-7-toast";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            return new Response(
              JSON.stringify({
                id: jobId,
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
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: "transcribing",
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("fires the toast once on the transition and persists the seen flag", async () => {
      stubSucceededJob();
      renderPage();
      await waitFor(
        () =>
          expect(toastSuccessMock).toHaveBeenCalledWith(
            "Transcription terminée — ton récit est consigné.",
          ),
        { timeout: 4000 },
      );
      expect(toastSuccessMock).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(window.localStorage.getItem(toastSeenKey)).toBe("1"),
      );
    });

    test("does NOT re-fire the toast on a later visit (persisted flag set)", async () => {
      window.localStorage.setItem(toastSeenKey, "1");
      stubSucceededJob();
      renderPage();
      await screen.findByRole("heading", { level: 1 });
      // Give polling a beat to settle on the succeeded job.
      await waitFor(() =>
        expect(
          screen.getByLabelText("État de la transcription : Transcrite"),
        ).toBeInTheDocument(),
      );
      expect(toastSuccessMock).not.toHaveBeenCalled();
    });
  });

  describe("Story 4.7 — Single state chip (S1)", () => {
    function stubWithJob(opts: {
      state: string;
      jobStatus: string;
      jobId?: string;
    }) {
      const jobId = opts.jobId ?? "job-4-7-chip";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(JSON.stringify(baseCampaign), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            return new Response(
              JSON.stringify({
                id: jobId,
                kind: "transcription",
                session_id: sessionIdFixture,
                status: opts.jobStatus,
                failure_reason: null,
                queued_at: "2026-05-31T19:00:00+00:00",
                started_at: "2026-05-31T19:00:05+00:00",
                ended_at: null,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: opts.state,
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
    }

    test("shows exactly one chip (live job) — no duplicate static state badge", async () => {
      stubWithJob({ state: "audio_uploaded", jobStatus: "queued" });
      renderPage();
      // The live-job chip is present…
      expect(
        await screen.findByLabelText("État de la transcription : En file"),
      ).toBeInTheDocument();
      // …and the static "Audio uploadé" duplicate is gone (was the S1 bug).
      expect(screen.queryByText("Audio uploadé")).not.toBeInTheDocument();
    });

    test("shows a single static chip for 'created' (no active job)", async () => {
      stubFetch({});
      renderPage();
      await screen.findByRole("heading", { level: 1 });
      expect(
        screen.getByLabelText("État de la séance : Créée"),
      ).toBeInTheDocument();
      expect(screen.getByText("Créée")).toBeInTheDocument();
    });

    test("shows a single colour-coded chip for a 'transcribed' session with no active job", async () => {
      stubFetch({ session: { ...baseSession, state: "transcribed" } });
      renderPage();
      await screen.findByRole("heading", { level: 1 });
      const chip = await screen.findByLabelText("État de la séance : Transcrite");
      expect(chip).toBeInTheDocument();
      expect(chip.className).toContain("text-state-success");
    });
  });
});
