import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createSessionState, installAuthMocks } from "../helpers/mocks";

const campId = "campaign-default-uuid";
const sessionId = "00000000-0000-0000-0000-000000000abc";

// Note: in mock mode (NEXT_PUBLIC_MOCK_AUDIO=true) the upload short-circuits and
// generates a random job_id, so we intercept /jobs/* by wildcard (mode-agnostic)
// and echo back the id from the requested URL.

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

const sessionTranscribing = { ...sessionCreated, state: "transcribing" };

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

test("the job polls live from running (with %) to succeeded, surfaces the final act + completion toast without reload", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaign(page);

  const nowIso = new Date().toISOString();

  let sessionGetCount = 0;
  await page.route(`**/services/jdr/sessions/${sessionId}`, async (route) => {
    if (route.request().method() === "GET") {
      sessionGetCount += 1;
      const payload = sessionGetCount === 1 ? sessionCreated : sessionTranscribing;
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return;
    }
    await route.continue();
  });

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
            duration_seconds: 600,
            uploaded_at: nowIso,
            job_id: "11111111-2222-3333-4444-555555555555",
          }),
        });
        return;
      }
      await route.continue();
    },
  );

  // Live job polling (wildcard id): running for the first few polls, then
  // succeeded. The job id is echoed from the requested URL so it works both
  // with the real POST path and the mock shortcut (random uuid).
  let jobGetCount = 0;
  await page.route("**/services/jdr/jobs/*", async (route) => {
    const url = route.request().url();
    const id = url.split("/").pop() ?? "job";
    jobGetCount += 1;
    const terminal = jobGetCount >= 3;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id,
        kind: "transcription",
        session_id: sessionId,
        status: terminal ? "succeeded" : "running",
        failure_reason: null,
        queued_at: nowIso,
        started_at: nowIso,
        ended_at: terminal ? new Date().toISOString() : null,
      }),
    });
  });

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: sessionCreated.title }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "demo.m4a",
    mimeType: "audio/mp4",
    buffer: Buffer.from([0, 0, 0, 0]),
  });
  await page.getByRole("button", { name: "Envoyer" }).click();

  // Running phase: the scribes act with a determinate progress bar.
  await expect(page.getByText("Les scribes transcrivent")).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();

  // No reload: the job converges to succeeded → final act + completion toast.
  await expect(page.getByText("Le récit est consigné")).toBeVisible();
  await expect(
    page.getByText("Transcription terminée — ton récit est consigné."),
  ).toBeVisible();
});
