import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

const campId = "campaign-default-uuid";
const sessionId = "00000000-0000-0000-0000-000000000abc";

const campaignFixture = {
  id: campId,
  name: "Campagne par défaut",
  description: null,
  role: "gm" as const,
  session_count: 1,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const sessionFixture = {
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

async function mockCampaignAndSession(page: Page) {
  await page.route(
    `**/services/jdr/campaigns/${campId}`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(campaignFixture),
        });
        return;
      }
      await route.continue();
    },
  );
  await page.route(
    `**/services/jdr/sessions/${sessionId}`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sessionFixture),
        });
        return;
      }
      await route.continue();
    },
  );
}

test("GM picks an M4A via the dropzone and the preparing panel shows filename + MB", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignAndSession(page);

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: sessionFixture.title }),
  ).toBeVisible();

  // The hidden <input type="file"> sits inside the dropzone — setInputFiles
  // exercises the same handleFile path as a real drop.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "demo.m4a",
    mimeType: "audio/mp4",
    // 1 MiB of zeros so the panel displays "1.0 MB".
    buffer: Buffer.alloc(1024 * 1024),
  });

  await expect(page.getByText("Fichier prêt :")).toBeVisible();
  await expect(page.getByText("demo.m4a")).toBeVisible();
  await expect(page.getByText(/1\.0 MB/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler" })).toBeVisible();

  // Story 3.3 enabled the Envoyer button — assert it is now usable.
  const sendButton = page.getByRole("button", { name: "Envoyer" });
  await expect(sendButton).toBeVisible();
  await expect(sendButton).not.toBeDisabled();
});

test("Picking a non-M4A file triggers the rejection toast and stays on the dropzone", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignAndSession(page);

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(
    page.getByRole("button", { name: /Glisse ton M4A/ }),
  ).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("rejected"),
  });

  await expect(
    page.getByText("Format non supporté. Glisse un fichier .m4a."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Glisse ton M4A/ }),
  ).toBeVisible();
  await expect(page.getByText("Fichier prêt :")).not.toBeVisible();
});
