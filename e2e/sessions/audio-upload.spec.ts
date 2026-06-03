import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

const campId = "campaign-default-uuid";
const sessionId = "00000000-0000-0000-0000-000000000abc";
const jobId = "11111111-2222-3333-4444-555555555555";

const campaignFixture = {
  id: campId,
  name: "Campagne par défaut",
  description: null,
  role: "gm" as const,
  session_count: 1,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const sessionCreated = {
  id: sessionId,
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
};

// Story 3.4 (BD-8) : le job se récupère via SessionOut.current_job_id, donc le
// refetch post-upload doit le porter (sinon il écrase l'update optimiste).
const sessionUploaded = {
  ...sessionCreated,
  state: "audio_uploaded",
  current_job_id: jobId,
};

async function mockCampaign(page: Page) {
  await page.route(`**/services/jdr/campaigns/${campId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(campaignFixture),
      });
      return;
    }
    await route.continue();
  });
}

test("GM uploads an M4A and the JobStateBadge 'En file' appears while the dropzone disappears", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaign(page);

  // GET /sessions/{id}: first call returns "created", subsequent calls (after
  // upload-triggered invalidation) return "audio_uploaded".
  let sessionGetCount = 0;
  await page.route(
    `**/services/jdr/sessions/${sessionId}`,
    async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        sessionGetCount += 1;
        const payload = sessionGetCount === 1 ? sessionCreated : sessionUploaded;
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        return;
      }
      await route.continue();
    },
  );

  // POST /sessions/{id}/audio: returns 202 with a fake job_id.
  await page.route(
    `**/services/jdr/sessions/${sessionId}/audio`,
    async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            path: `data/audio/${sessionId}.m4a`,
            sha256: "a".repeat(64),
            size_bytes: 1024,
            duration_seconds: null,
            uploaded_at: "2026-05-30T20:01:00+00:00",
            job_id: jobId,
          }),
        });
        return;
      }
      await route.continue();
    },
  );

  // Live job polling (wildcard id, mode-agnostic): echo the requested id and
  // return a queued job. Works whether the upload ran for real (job_id = jobId)
  // or short-circuited in mock mode (random uuid) — the page polls whatever
  // current_job_id the refetched session carries.
  await page.route("**/services/jdr/jobs/*", async (route) => {
    const id = route.request().url().split("/").pop() ?? "job";
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        kind: "transcription",
        session_id: sessionId,
        status: "queued",
        failure_reason: null,
        queued_at: "2026-05-30T20:01:00+00:00",
        started_at: null,
        ended_at: null,
      }),
    });
  });

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: sessionCreated.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Glisse ton M4A/ }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "demo.m4a",
    mimeType: "audio/mp4",
    buffer: Buffer.from([0, 0, 0, 0]),
  });
  // Le nom du fichier sélectionné s'affiche AVANT l'envoi (pas de rituel).
  await expect(page.getByText("demo.m4a")).toBeVisible();
  await expect(page.getByText("Le parchemin se prépare")).not.toBeVisible();

  await page.getByRole("button", { name: "Envoyer" }).click();

  // The session refetched returns audio_uploaded so the dropzone unmounts.
  await expect(
    page.getByRole("button", { name: /Glisse ton M4A/ }),
  ).not.toBeVisible();

  // The job (current_job_id on the refetched session) polls as queued → badge.
  await expect(
    page.getByLabel("État de la transcription : En file"),
  ).toBeVisible();
});
