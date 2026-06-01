import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

const campId = "campaign-default-uuid";
const createdSession = {
  id: "00000000-0000-0000-0000-000000000abc",
  title: "Session 7 — La crypte oubliée",
  recorded_at: "2026-05-31T18:00:00.000Z",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-31T18:05:00.000Z",
  updated_at: "2026-05-31T18:05:00.000Z",
};

const campaignFixture = {
  id: campId,
  name: "Campagne par défaut",
  description: null,
  role: "gm" as const,
  session_count: 0,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

async function mockCampaignDetail(page: Page) {
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
}

async function mockSessionCreate(page: Page) {
  await page.route("**/services/jdr/sessions", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      await route.fulfill({
        status: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createdSession),
      });
      return;
    }
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          size: 50,
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(
    `**/services/jdr/sessions/${createdSession.id}`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(createdSession),
        });
        return;
      }
      await route.continue();
    },
  );
}

test("GM creates a session inside a campaign and lands on the new session detail page", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page);
  await mockSessionCreate(page);

  await page.goto(`/jdr/campaigns/${campId}/sessions/new`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Nouvelle session" }),
  ).toBeVisible();
  await page.getByLabel("Titre").fill("Session 7 — La crypte oubliée");
  // Date input is pre-filled with today; just keep it.

  await page.getByRole("button", { name: "Créer la session" }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/jdr/campaigns/${campId}/sessions/${createdSession.id}$`,
    ),
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Session 7 — La crypte oubliée",
    }),
  ).toBeVisible();
  await expect(page.getByText("Créée")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Uploader l'audio de la séance" }),
  ).toBeDisabled();
});

test("the new-session form is reachable via direct URL and exposes the campaign breadcrumb", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page);
  await mockSessionCreate(page);

  await page.goto(`/jdr/campaigns/${campId}/sessions/new`);
  await expect(page.getByLabel("Titre")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Campagne par défaut/ }),
  ).toBeVisible();
});
