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

const sessionUploaded = { ...sessionCreated, state: "audio_uploaded" };

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

test("the ritual tracker shows Acte I on drop (no technical jargon) then advances to the scribes act", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaign(page);

  let sessionGetCount = 0;
  await page.route(`**/services/jdr/sessions/${sessionId}`, async (route) => {
    if (route.request().method() === "GET") {
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

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: sessionCreated.title }),
  ).toBeVisible();

  // Drop an M4A → carte de confirmation (nom du fichier), pas encore de rituel.
  await page.locator('input[type="file"]').setInputFiles({
    name: "demo.m4a",
    mimeType: "audio/mp4",
    buffer: Buffer.from([0, 0, 0, 0]),
  });
  await expect(page.getByText("demo.m4a")).toBeVisible();
  await expect(page.getByText("Le parchemin se prépare")).toHaveCount(0);

  // No technical vocabulary leaks into the UI.
  await expect(page.getByText(/Réduction audio/i)).toHaveCount(0);
  await expect(page.getByText("%")).toHaveCount(0);

  // Confirm → upload → session refetches as audio_uploaded → Acte II « scribes ».
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Les scribes transcrivent")).toBeVisible();
});
