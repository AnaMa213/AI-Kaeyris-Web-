import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

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

test("GM creates a session and lands on /jdr/sessions/{id} with the title + state badge", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockSessionCreate(page);

  await page.goto("/jdr/sessions/new");

  await expect(
    page.getByRole("heading", { level: 1, name: "Nouvelle session" }),
  ).toBeVisible();
  await page.getByLabel("Titre").fill("Session 7 — La crypte oubliée");
  // Date input is pre-filled with today; just keep it.

  await page.getByRole("button", { name: "Créer la session" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/jdr/sessions/${createdSession.id}$`),
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Session 7 — La crypte oubliée",
    }),
  ).toBeVisible();
  await expect(page.getByText("Créée")).toBeVisible();
  await expect(page.getByText("Aucun audio uploadé")).toBeVisible();
});

test("clicking 'Nouvelle session' on the empty /jdr/sessions library opens the creation form", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockSessionCreate(page);

  await page.goto("/jdr/sessions");

  await expect(page.getByText("Aucune session encore.")).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle session" }).click();
  await expect(page).toHaveURL(/\/jdr\/sessions\/new$/);
  await expect(page.getByLabel("Titre")).toBeVisible();
});
