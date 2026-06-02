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

interface SessionFixture {
  id: string;
  title: string;
  recorded_at: string;
  mode: string;
  state: string;
  transcription_mode: string;
  campaign_context: string | null;
  created_at: string;
  updated_at: string;
}

const initialSession: SessionFixture = {
  id: sessionId,
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: "Bibliothèque oubliée. PNJ Eilord à surveiller.",
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
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

async function mockSessionWithPatch(
  page: Page,
  opts: {
    initial: SessionFixture;
    onPatch?: (body: unknown) => void;
    patchedTitle?: string;
    patchedContext?: string | null;
  },
) {
  let current: SessionFixture = { ...opts.initial };
  await page.route(
    `**/services/jdr/sessions/${sessionId}`,
    async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(current),
        });
        return;
      }
      if (method === "PATCH") {
        const body = route.request().postDataJSON();
        opts.onPatch?.(body);
        current = {
          ...current,
          title: opts.patchedTitle ?? current.title,
          campaign_context:
            opts.patchedContext !== undefined
              ? opts.patchedContext
              : current.campaign_context,
        };
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(current),
        });
        return;
      }
      await route.continue();
    },
  );
}

test("GM edits a session title and sees it reflected on the detail page header", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page);
  await mockSessionWithPatch(page, {
    initial: initialSession,
    patchedTitle: "Session 12 — La cité engloutie (corrigée)",
  });

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Session 12 — La cité engloutie",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Modifier" }).click();
  await expect(
    page.getByRole("heading", { name: "Modifier la session" }),
  ).toBeVisible();

  await page.getByLabel("Titre").fill("Session 12 — La cité engloutie (corrigée)");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Session 12 — La cité engloutie (corrigée)",
    }),
  ).toBeVisible();
});

test("GM clears the campaign_context and the PATCH body sends null", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page);

  let capturedBody: unknown = null;
  await mockSessionWithPatch(page, {
    initial: initialSession,
    onPatch: (body) => {
      capturedBody = body;
    },
    patchedContext: null,
  });

  await page.goto(`/jdr/campaigns/${campId}/sessions/${sessionId}`);
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByLabel(/Contexte de campagne/).fill("");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("heading", { name: "Modifier la session" }),
  ).not.toBeVisible();
  expect(
    (capturedBody as { campaign_context?: unknown } | null)?.campaign_context,
  ).toBeNull();
});
