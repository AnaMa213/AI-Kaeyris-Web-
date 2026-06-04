import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createSessionState, installAuthMocks } from "../helpers/mocks";

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

const sessionFailed = {
  id: sessionId,
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch",
  state: "transcription_failed",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
};

// After the replace (DELETE → POST) the session refetch carries the new
// current_job_id (Story 3.4/BD-8) so the live polling re-arms.
const sessionUploaded = {
  ...sessionFailed,
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

test("GM recovers from a failed transcription by replacing the audio (confirm → DELETE+POST → transcribing)", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaign(page);

  // GET /sessions/{id}: first call = transcription_failed, subsequent calls
  // (after the replace-triggered invalidation) = audio_uploaded + current_job_id.
  let sessionGetCount = 0;
  await page.route(`**/services/jdr/sessions/${sessionId}`, async (route) => {
    if (route.request().method() === "GET") {
      sessionGetCount += 1;
      const payload = sessionGetCount === 1 ? sessionFailed : sessionUploaded;
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return;
    }
    await route.continue();
  });

  // DELETE + POST /audio (mode-agnostic): in mock-audio build these short-circuit
  // client-side, but the routes keep the spec correct for the real path too.
  await page.route(`**/services/jdr/sessions/${sessionId}/audio`, async (route) => {
    const method = route.request().method();
    if (method === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (method === "POST") {
      await route.fulfill({
        status: 202,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          path: `data/audio/${sessionId}.m4a`,
          sha256: "a".repeat(64),
          size_bytes: 1024,
          duration_seconds: 600,
          uploaded_at: new Date().toISOString(),
          job_id: jobId,
        }),
      });
      return;
    }
    await route.continue();
  });

  // Live job polling (wildcard id): echo the requested id, queued for the badge.
  await page.route("**/services/jdr/jobs/*", async (route) => {
    const id = route.request().url().split("/").pop() ?? "job";
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        kind: "transcription",
        session_id: sessionId,
        status: "running",
        failure_reason: null,
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        ended_at: null,
      }),
    });
  });

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);

  // Failed act with a recovery affordance.
  await expect(page.getByText("Le grimoire est resté muet")).toBeVisible();
  await page
    .getByRole("button", { name: "Remplacer l'enregistrement" })
    .click();

  // Replace dropzone appears; drop a new file → confirmation card.
  await expect(
    page.getByRole("button", { name: /Glisse ton M4A/ }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "fixed.m4a",
    mimeType: "audio/mp4",
    buffer: Buffer.from([0, 0, 0, 0]),
  });
  await expect(page.getByText("fixed.m4a")).toBeVisible();

  // Envoyer opens the destructive confirm dialog; nothing happens until confirm.
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Confirm → DELETE+POST → session refetches audio_uploaded → transcribing act.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remplacer l'enregistrement" })
    .click();

  await expect(page.getByText("Les scribes transcrivent")).toBeVisible();
});

test("the replace affordance is absent while transcribing (locked state)", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaign(page);

  await page.route(`**/services/jdr/sessions/${sessionId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...sessionFailed, state: "transcribing" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(page.getByText("Les scribes transcrivent")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remplacer l'enregistrement" }),
  ).toHaveCount(0);
});
