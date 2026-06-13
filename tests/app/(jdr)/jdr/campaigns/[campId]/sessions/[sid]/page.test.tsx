// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
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
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ campId, sid: sessionIdFixture }),
  usePathname: () => currentPathname,
  useRouter: () => ({ push: pushMock }),
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
  markdown?: string;
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
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        typeof input === "string"
          ? (init?.method ?? "GET")
          : (input.method ?? "GET");
      const upper = method.toUpperCase();
      if (url.includes(`/services/jdr/campaigns/${campId}`)) {
        return new Response(JSON.stringify(opts.campaign ?? baseCampaign), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // `/chunks` and `/transcription` are sub-paths of the session URL — match
      // them BEFORE the generic session matcher below, or they'd return a
      // SessionOut instead of the transcription payload.
      if (url.endsWith(`/services/jdr/sessions/${sessionIdFixture}/transcription.md`)) {
        return new Response(opts.markdown ?? "# Transcription\n\nContenu.", {
          status: 200,
          headers: { "content-type": "text/markdown" },
        });
      }
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
      if (
        url.includes(`/services/jdr/sessions/${sessionIdFixture}`) &&
        upper === "DELETE"
      ) {
        return new Response(null, { status: 204 });
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
    pushMock.mockClear();
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

  test("hides the old 'Lire l'audio' CTA before the transcription is ready, hides the dropzone", async () => {
    stubFetch({ session: { ...baseSession, state: "audio_uploaded" } });
    renderPage();
    await screen.findByRole("heading", { level: 1 });

    expect(
      screen.queryByRole("button", {
        name: "Lire l'audio de la séance",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Glisse ton M4A/ }),
    ).not.toBeInTheDocument();
  });

  test("wires 'Afficher la transcription' to the transcription dialog once transcribed", async () => {
    stubFetch({
      session: { ...baseSession, state: "transcribed" },
      chunks: [{ chunk_id: "chunk-1", ordre: 1, text: "Audio et transcription." }],
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "Afficher la transcription",
      }),
    );

    expect(
      screen.queryByRole("button", { name: "Lire l'audio de la séance" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByLabelText("Lecteur audio de la séance"),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Audio et transcription/)).toBeInTheDocument();
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
      await screen.findByRole("button", { name: "Modifier la séance" }),
    ).toBeInTheDocument();
  });

  test("does NOT render the Modifier button when the campaign role is pj (Story 2.8)", async () => {
    stubFetch({ campaign: { ...baseCampaign, role: "pj" } });
    renderPage();
    // Wait for the page to settle (h1 rendered)
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("button", { name: "Modifier la séance" }),
    ).not.toBeInTheDocument();
  });

  test("deletes the session after confirmation and returns to the campaign", async () => {
    stubFetch({});
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Supprimer la séance" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /Supprimer Session 7/ }),
    ).toBeInTheDocument();
    const confirmButton = within(dialog).getByRole("button", {
      name: "Supprimer la séance",
    });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Tape/), baseSession.title);
    await user.click(confirmButton);

    await waitFor(() => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      expect(
        fetchMock.mock.calls.some((args) => {
          const input = args[0] as Request | string;
          const init = args[1] as RequestInit | undefined;
          const url = typeof input === "string" ? input : input.url;
          const method =
            typeof input === "string"
              ? (init?.method ?? "GET")
              : (input.method ?? "GET");
          return (
            url.includes(`/services/jdr/sessions/${sessionIdFixture}`) &&
            method.toUpperCase() === "DELETE"
          );
        }),
      ).toBe(true);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Séance supprimée.");
    expect(pushMock).toHaveBeenCalledWith(`/jdr/campaigns/${campId}`);
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
    const editButton = await screen.findByRole("button", {
      name: "Modifier la séance",
    });
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
      await screen.findByText("Ton récit est consigné.");
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

    test("no replace CTA or story gate while the polled job succeeded but session cache is still stale", async () => {
      stubWithPolledJob("succeeded");
      renderPage();
      await waitFor(() =>
        expect(
          screen.getByLabelText("État de la transcription : Transcrite"),
        ).toBeInTheDocument(),
      );
      expect(
        screen.queryByText("Ton récit est consigné."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Ouvrir le récit" }),
      ).not.toBeInTheDocument();
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
      await screen.findByText("En attente dans la file...");
      await user.click(
        screen.getByRole("button", { name: "Remplacer l'enregistrement" }),
      );
      expect(
        screen.queryByRole("button", { name: /Glisse ton M4A/ }),
      ).not.toBeInTheDocument();
    });

    test("re-enables replace when the cached current_job_id is not found", async () => {
      const jobId = "job-stale-replace";
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
                type: "https://kaeyris.local/errors/job-not-found",
                title: "Job not found",
                status: 404,
              }),
              {
                status: 404,
                headers: { "content-type": "application/problem+json" },
              },
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
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Les scribes transcrivent");
      const replace = screen.getByRole("button", {
        name: "Remplacer l'enregistrement",
      });
      await waitFor(() => expect(replace).toBeEnabled());

      await user.click(replace);

      expect(
        await screen.findByRole("button", { name: /Glisse ton M4A/ }),
      ).toBeInTheDocument();
    });

  });

  // Story 4.13 viewer behaviour preserved, but Story 4.21 moves the raw
  // transcription off the main flow into a header-triggered pop-up.
  describe("Story 4.13 / 4.21 — Transcription viewer (in pop-up)", () => {
    async function openTranscriptionDialog() {
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", {
          name: "Afficher la transcription",
        }),
      );
    }

    test("is NOT inline: the raw transcription stays hidden until the pop-up opens", async () => {
      stubFetch({
        session: { ...baseSession, state: "transcribed" },
        markdown: "# Transcription\n\nLe héros entre dans la crypte.",
      });
      renderPage();
      // The story gate is the first surface; the raw transcription is not inline.
      await screen.findByText("Ton récit est consigné.");
      expect(
        screen.queryByText(/Le héros entre dans la crypte/),
      ).not.toBeInTheDocument();
    });

    test("renders sorted chunks for a transcribed non_diarised session", async () => {
      stubFetch({
        session: {
          ...baseSession,
          state: "transcribed",
          transcription_mode: "non_diarised",
        },
        chunks: [
          { chunk_id: "c2", ordre: 2, text: "Puis la porte s'ouvre." },
          { chunk_id: "c1", ordre: 1, text: "Le héros entre dans la crypte." },
        ],
      });
      renderPage();
      await openTranscriptionDialog();
      await screen.findByText(/Le héros entre dans la crypte/);
      const text = document.body.textContent ?? "";
      expect(text.indexOf("Le héros")).toBeLessThan(
        text.indexOf("Puis la porte"),
      );
    });

    test("renders canonical Markdown for a transcribed diarised session", async () => {
      stubFetch({
        session: {
          ...baseSession,
          state: "transcribed",
          transcription_mode: "diarised",
        },
        markdown: "**speaker_1** : Salutations, aventuriers.",
      });
      renderPage();
      await openTranscriptionDialog();
      expect(
        await screen.findByText(/Salutations, aventuriers/),
      ).toBeInTheDocument();
      expect(screen.getByText(/speaker_1/)).toBeInTheDocument();
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
      window.history.replaceState(null, "", `${currentPathname}?sub=summary`);
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
      // Story 4.21 : un lecteur atterrit directement sur les sous-onglets.
      await screen.findByRole("tab", { name: "Résumé" });
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

    // Story 4.21 — the top-level Transcription/Artefacts tabs are gone; a
    // `created` GM session lands straight on the upload card.
    test("drops the top-level tabs; a created GM session shows the upload card", async () => {
      stubForTabs({ state: "created", role: "gm" });
      renderPage();

      expect(
        await screen.findByRole("button", { name: /Glisse ton M4A/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: "Transcription" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: "Artefacts" }),
      ).not.toBeInTheDocument();
    });

    test("disabled artifact sub-tabs expose the required tooltip copy", async () => {
      // seenKey set → récit déjà ouvert → on atterrit sur les sous-onglets.
      window.localStorage.setItem(seenKey, "1");
      window.history.replaceState(null, "", `${currentPathname}?sub=summary`);
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
      window.history.replaceState(null, "", `${currentPathname}?sub=summary`);
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
      window.history.replaceState(null, "", `${currentPathname}?sub=${sub}`);
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

  describe("Story 4.17 - Inline transcription editing", () => {
    test("disables the inline edit action while a transcription job is active", async () => {
      const jobId = "job-4-17-active";
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
                status: "running",
                failure_reason: null,
                queued_at: "2026-05-31T19:00:00+00:00",
                started_at: "2026-05-31T19:00:05+00:00",
                ended_at: null,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.endsWith("/transcription.md")) {
            return new Response("# Transcription\n\nTexte corrigeable", {
              status: 200,
              headers: { "content-type": "text/markdown" },
            });
          }
          if (url.includes("/artifacts/summary")) {
            return new Response(
              JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
              { status: 404, headers: { "content-type": "application/problem+json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: "transcribed",
                transcription_mode: "diarised",
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );

      const user = userEvent.setup();
      renderPage();
      // Story 4.21 : l'édition vit dans la pop-up transcription.
      await user.click(
        await screen.findByRole("button", {
          name: "Afficher la transcription",
        }),
      );
      await screen.findByText(/Texte corrigeable/);
      const editButton = screen.getByRole("button", { name: "Modifier" });
      expect(editButton).toBeDisabled();
      expect(editButton).toHaveAttribute(
        "title",
        "Transcription en cours — modification bloquée.",
      );
    });

    test("allows inline editing when current_job_id is stale and the job is not found", async () => {
      const jobId = "job-4-17-stale";
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
                type: "https://kaeyris.local/errors/job-not-found",
                title: "Job not found",
                status: 404,
              }),
              {
                status: 404,
                headers: { "content-type": "application/problem+json" },
              },
            );
          }
          if (url.endsWith("/transcription.md")) {
            return new Response("# Transcription\n\nTexte corrigeable", {
              status: 200,
              headers: { "content-type": "text/markdown" },
            });
          }
          if (url.includes("/artifacts/summary")) {
            return new Response(
              JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
              { status: 404, headers: { "content-type": "application/problem+json" } },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: "transcribed",
                transcription_mode: "diarised",
                current_job_id: jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );
      const user = userEvent.setup();
      renderPage();
      // Story 4.21 : ouvrir la pop-up transcription pour accéder à l'éditeur.
      await user.click(
        await screen.findByRole("button", {
          name: "Afficher la transcription",
        }),
      );
      const viewer = await screen.findByLabelText("Transcription de la séance");
      const editButton = within(viewer).getByRole("button", {
        name: "Modifier",
      });
      await waitFor(() => expect(editButton).toBeEnabled());

      await user.click(editButton);

      expect(
        within(viewer).getByRole("textbox", { name: "Transcription Markdown" }),
      ).toHaveValue("# Transcription\n\nTexte corrigeable");
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

  // Story 4.18 — Pipeline verification after the BD-11 worker→LLM unblock. The
  // `summaryExists` gate (4.3) and the regeneration flow (4.5) were already built,
  // but the *live* transitions through a SUCCEEDING summary job were untestable
  // while every job failed on httpx.ConnectError. These lock them as regressions.
  // BD-11 is infra-only: no contract change, no gen:api.
  describe("Story 4.18 — Pipeline verification after LLM unblock (BD-11)", () => {
    const ARTIFACT_GATED = ["Récit", "Éléments", "POVs"];

    function gotoSummaryTab() {
      window.localStorage.setItem(seenKey, "1");
      window.history.replaceState(null, "", `${currentPathname}?sub=summary`);
    }

    // AC2 — the summary GET starts 404 (absent) and flips to 200 only after the
    // polled job reaches `succeeded`. Mirrors the 4.3 stub shape but drives the
    // dynamic absent→present transition.
    function stubLiveSummaryGeneration() {
      let summaryJobSucceeded = false;
      const derivedPosts: string[] = [];
      const jobId = "job-summary-418";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string, init?: RequestInit) => {
          const url = typeof input === "string" ? input : input.url;
          const method =
            (typeof input === "string" ? init?.method : input.method) ?? "GET";
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
              JSON.stringify({ session_id: sessionIdFixture, pj_ids: ["pj-1"], updated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          // Guard: derived artifacts must never be POSTed by this flow (no cascade).
          if (
            (url.includes("/artifacts/narrative") ||
              url.includes("/artifacts/elements") ||
              url.includes("/artifacts/povs")) &&
            method.toUpperCase() === "POST"
          ) {
            derivedPosts.push(url);
            return new Response(
              JSON.stringify({ id: "job-derived", kind: "narrative", session_id: sessionIdFixture, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
              { status: 202, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
            return new Response(
              JSON.stringify({ id: jobId, kind: "summary", session_id: sessionIdFixture, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
              { status: 202, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary")) {
            if (!summaryJobSucceeded) {
              return new Response(
                JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
                { status: 404, headers: { "content-type": "application/problem+json" } },
              );
            }
            return new Response(
              JSON.stringify({ session_id: sessionIdFixture, text: "Les héros pénètrent dans la crypte oubliée.", model_used: "claude-x", generated_at: "2026-06-01T10:05:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            summaryJobSucceeded = true;
            return new Response(
              JSON.stringify({ id: jobId, kind: "summary", session_id: sessionIdFixture, status: "succeeded", failure_reason: null, queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: "2026-06-01T10:00:05Z" }),
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
      return { derivedPosts };
    }

    test("AC2 — Récit/Éléments/POVs un-grey live when the summary job succeeds (no reload)", async () => {
      gotoSummaryTab();
      const { derivedPosts } = stubLiveSummaryGeneration();
      const user = userEvent.setup();
      renderPage();

      // Gate closed on load: the summary is absent (404).
      await screen.findByRole("tab", { name: "Résumé" });
      for (const name of ARTIFACT_GATED) {
        expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-disabled", "true");
      }

      // The GM generates the summary; the trigger is enabled once the declared PJ loads.
      const trigger = await screen.findByRole("button", { name: "Générer le Résumé" });
      await waitFor(() => expect(trigger).toBeEnabled());
      await user.click(trigger);

      // On the job's `succeeded`, the shared summary cache key is invalidated; the
      // page's summaryExists flips and the three derived sub-tabs un-grey in place.
      await waitFor(
        () =>
          expect(screen.getByRole("tab", { name: "Récit" })).not.toHaveAttribute(
            "aria-disabled",
            "true",
          ),
        { timeout: 4000 },
      );
      expect(screen.getByRole("tab", { name: "Éléments" })).not.toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("tab", { name: "POVs" })).not.toHaveAttribute("aria-disabled", "true");
      // No cascade: generating the summary never POSTed a derived artifact.
      expect(derivedPosts).toEqual([]);
    });

    // AC3 — regeneration against a succeeding job, driven through the page. The
    // post-regen GET returns a NEW generated_at so the flow's settle loop stops.
    test("AC3 — regenerate replaces the summary in place end-to-end; sub-tabs stay enabled, no cascade", async () => {
      gotoSummaryTab();
      let summaryPostCount = 0;
      let regenJobPollCount = 0;
      let regenJobSucceeded = false;
      const derivedPosts: string[] = [];
      const jobId = "job-summary-regen-418";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string, init?: RequestInit) => {
          const url = typeof input === "string" ? input : input.url;
          const method =
            (typeof input === "string" ? init?.method : input.method) ?? "GET";
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
              JSON.stringify({ session_id: sessionIdFixture, pj_ids: ["pj-1"], updated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (
            (url.includes("/artifacts/narrative") ||
              url.includes("/artifacts/elements") ||
              url.includes("/artifacts/povs")) &&
            method.toUpperCase() === "POST"
          ) {
            derivedPosts.push(url);
            return new Response(null, { status: 202 });
          }
          if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
            summaryPostCount += 1;
            return new Response(
              JSON.stringify({ id: jobId, kind: "summary", session_id: sessionIdFixture, status: "queued", queued_at: "2026-06-01T11:00:00Z" }),
              { status: 202, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary")) {
            // New version only after the regen job succeeds so artifactVersion
            // (generated_at) changes at the same boundary as production.
            const regenerated = regenJobSucceeded;
            return new Response(
              JSON.stringify({
                session_id: sessionIdFixture,
                text: regenerated ? "Récit régénéré : la crypte révèle un autre secret." : "Récit initial de la séance.",
                model_used: "claude-x",
                generated_at: regenerated ? "2026-06-01T11:05:00Z" : "2026-06-01T10:05:00Z",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            regenJobPollCount += 1;
            const status = regenJobPollCount > 1 ? "succeeded" : "running";
            regenJobSucceeded = status === "succeeded";
            const now = new Date().toISOString();
            return new Response(
              JSON.stringify({
                id: jobId,
                kind: "summary",
                session_id: sessionIdFixture,
                status,
                failure_reason: null,
                queued_at: now,
                started_at: now,
                ended_at: status === "succeeded" ? now : null,
              }),
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

      const user = userEvent.setup();
      renderPage();

      // Summary present on load → content shown, sub-tabs already enabled.
      expect(await screen.findByText("Récit initial de la séance.")).toBeInTheDocument();
      for (const name of ARTIFACT_GATED) {
        expect(screen.getByRole("tab", { name })).not.toHaveAttribute("aria-disabled", "true");
      }

      // Regenerate → confirm Dialog → second POST → new content replaces the old.
      await user.click(screen.getByRole("button", { name: "Régénérer le Résumé" }));
      await user.click(screen.getByRole("button", { name: "Régénérer" }));

      expect(screen.getByText("Récit initial de la séance.")).toBeInTheDocument();
      expect(
        screen.queryByText("Récit régénéré : la crypte révèle un autre secret."),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByText("Récit régénéré : la crypte révèle un autre secret.", {}, { timeout: 4000 }),
      ).toBeInTheDocument();
      expect(summaryPostCount).toBe(1);
      // The gate stays open and nothing cascaded onto the derived artifacts.
      for (const name of ARTIFACT_GATED) {
        expect(screen.getByRole("tab", { name })).not.toHaveAttribute("aria-disabled", "true");
      }
      expect(derivedPosts).toEqual([]);
    });

    // AC4 — a failed summary job (BD-11 AC-B2: status `failed` + failure_reason)
    // keeps the gate closed and surfaces the failure (inline + toast, Story 4.10).
    test("AC4 — a failed summary job keeps sub-tabs greyed and surfaces the failure", async () => {
      gotoSummaryTab();
      const jobId = "job-summary-fail-418";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string, init?: RequestInit) => {
          const url = typeof input === "string" ? input : input.url;
          const method =
            (typeof input === "string" ? init?.method : input.method) ?? "GET";
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
              JSON.stringify({ session_id: sessionIdFixture, pj_ids: ["pj-1"], updated_at: "2026-06-01T10:00:00Z" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary") && method.toUpperCase() === "POST") {
            return new Response(
              JSON.stringify({ id: jobId, kind: "summary", session_id: sessionIdFixture, status: "queued", queued_at: "2026-06-01T10:00:00Z" }),
              { status: 202, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary")) {
            // The generation failed → the artifact never materialises.
            return new Response(
              JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
              { status: 404, headers: { "content-type": "application/problem+json" } },
            );
          }
          if (url.includes(`/services/jdr/jobs/${jobId}`)) {
            return new Response(
              JSON.stringify({ id: jobId, kind: "summary", session_id: sessionIdFixture, status: "failed", failure_reason: "llm-unreachable", queued_at: "2026-06-01T10:00:00Z", started_at: "2026-06-01T10:00:01Z", ended_at: "2026-06-01T10:00:02Z" }),
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

      const user = userEvent.setup();
      renderPage();

      const trigger = await screen.findByRole("button", { name: "Générer le Résumé" });
      await waitFor(() => expect(trigger).toBeEnabled());
      await user.click(trigger);

      await waitFor(
        () =>
          expect(toastErrorMock).toHaveBeenCalledWith(
            expect.stringContaining("llm-unreachable"),
          ),
        { timeout: 4000 },
      );
      // The gate is still closed: derived sub-tabs remain disabled after the failure.
      for (const name of ARTIFACT_GATED) {
        expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-disabled", "true");
      }
      // The retry affordance is offered.
      expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    });
  });

  describe("Story 4.21 — unified narrative flow", () => {
    function stubFor421(opts: {
      role?: "gm" | "pj";
      markdown?: string;
      chunkText?: string;
    }) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: Request | string) => {
          const url = typeof input === "string" ? input : input.url;
          if (url.includes(`/services/jdr/campaigns/${campId}`)) {
            return new Response(
              JSON.stringify({ ...baseCampaign, role: opts.role ?? "gm" }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
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
          if (url.endsWith(`/transcription.md`)) {
            return new Response(opts.markdown ?? "# Transcription\n\nContenu.", {
              status: 200,
              headers: { "content-type": "text/markdown" },
            });
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}/chunks`)) {
            return new Response(
              JSON.stringify({
                session_id: sessionIdFixture,
                items: [
                  {
                    chunk_id: "chunk-1",
                    ordre: 1,
                    text: opts.chunkText ?? "Contenu brut de la séance.",
                  },
                ],
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (url.includes("/artifacts/summary")) {
            return new Response(
              JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
              {
                status: 404,
                headers: { "content-type": "application/problem+json" },
              },
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

    test("AC3 — a GM's first transcribed visit shows the story gate + a header Eye icon, not the raw transcription", async () => {
      stubFor421({ role: "gm" });
      renderPage();

      expect(
        await screen.findByText("Ton récit est consigné."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Ouvrir le récit" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Afficher la transcription" }),
      ).toBeInTheDocument();
      // No artifact sub-tabs before the gate is opened.
      expect(
        screen.queryByRole("tab", { name: "Résumé" }),
      ).not.toBeInTheDocument();
    });

    test("regression — job succeeded invalidates the stale session, then opening the story reveals artifact tabs", async () => {
      const jobId = "job-transcription-succeeded-refetch";
      let sessionFetchCount = 0;
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
            const now = new Date().toISOString();
            return new Response(
              JSON.stringify({
                id: jobId,
                kind: "transcription",
                session_id: sessionIdFixture,
                status: "succeeded",
                failure_reason: null,
                queued_at: now,
                started_at: now,
                ended_at: now,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
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
          if (url.includes("/artifacts/summary")) {
            return new Response(
              JSON.stringify({ type: "about:blank", title: "absent", status: 404 }),
              {
                status: 404,
                headers: { "content-type": "application/problem+json" },
              },
            );
          }
          if (url.includes(`/services/jdr/sessions/${sessionIdFixture}`)) {
            sessionFetchCount += 1;
            const transcribed = sessionFetchCount > 1;
            return new Response(
              JSON.stringify({
                ...baseSession,
                state: transcribed ? "transcribed" : "transcribing",
                current_job_id: transcribed ? null : jobId,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(null, { status: 200 });
        }),
      );

      const user = userEvent.setup();
      renderPage();

      const openStory = await screen.findByRole(
        "button",
        { name: "Ouvrir le récit" },
        { timeout: 4000 },
      );
      expect(sessionFetchCount).toBeGreaterThan(1);
      await user.click(openStory);

      expect(
        await screen.findByRole("tab", { name: "Résumé" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    test("AC4 — clicking 'Ouvrir le récit' reveals the artifact sub-tabs (Résumé) and persists the flag; the gate is gone", async () => {
      stubFor421({ role: "gm" });
      const user = userEvent.setup();
      renderPage();

      await user.click(
        await screen.findByRole("button", { name: "Ouvrir le récit" }),
      );

      expect(
        await screen.findByRole("tab", { name: "Résumé" }),
      ).toHaveAttribute("aria-selected", "true");
      expect(
        screen.queryByText("Ton récit est consigné."),
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(window.localStorage.getItem(seenKey)).toBe("1"),
      );
    });

    test("AC4 — a previously opened session lands directly on the sub-tabs (no gate)", async () => {
      window.localStorage.setItem(seenKey, "1");
      stubFor421({ role: "gm" });
      renderPage();

      expect(
        await screen.findByRole("tab", { name: "Résumé" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Ton récit est consigné."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Ouvrir le récit" }),
      ).not.toBeInTheDocument();
    });

    test("AC6 — a non-GM never sees the gate and lands on read-only artifacts", async () => {
      stubFor421({ role: "pj" });
      renderPage();

      expect(
        await screen.findByRole("tab", { name: "Résumé" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Ton récit est consigné."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Ouvrir le récit" }),
      ).not.toBeInTheDocument();
    });

    test("AC5 — the header Eye icon opens the raw transcription pop-up", async () => {
      stubFor421({
        role: "gm",
        chunkText: "Contenu brut de la séance.",
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(
        await screen.findByRole("button", {
          name: "Afficher la transcription",
        }),
      );
      expect(
        await screen.findByText(/Contenu brut de la séance/),
      ).toBeInTheDocument();
    });
  });
});
