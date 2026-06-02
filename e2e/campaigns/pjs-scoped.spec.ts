import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

const campId = "11111111-1111-1111-1111-111111111111";

interface CampaignFixture {
  id: string;
  name: string;
  description: string | null;
  role: "gm" | "pj";
  session_count: number;
  last_session_at: string | null;
  created_at: string;
}

interface PjFixture {
  id: string;
  name: string;
  campaign_id: string;
  created_at: string;
}

const gmCampaign: CampaignFixture = {
  id: campId,
  name: "Les Royaumes Brisés",
  description: null,
  role: "gm",
  session_count: 0,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

const pjCampaign: CampaignFixture = { ...gmCampaign, role: "pj" };

async function mockCampaignDetail(page: Page, fixture: CampaignFixture) {
  await page.route(
    `**/services/jdr/campaigns/${campId}`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(fixture),
        });
        return;
      }
      await route.continue();
    },
  );
}

async function mockSessionsList(page: Page) {
  await page.route(
    /\/services\/jdr\/sessions(\?|$)/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }),
      });
    },
  );
}

interface MockPjsOpts {
  initial: PjFixture[];
  onPost?: (body: unknown) => void;
}

async function mockCampaignPjs(page: Page, opts: MockPjsOpts) {
  let current: PjFixture[] = [...opts.initial];
  await page.route(/\/services\/jdr\/pjs(\?|$)/, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: current, total: current.length }),
      });
      return;
    }
    if (method === "POST") {
      const body = route.request().postDataJSON();
      opts.onPost?.(body);
      const created: PjFixture = {
        id: `pj-${current.length + 1}`,
        name: (body as { name: string }).name,
        campaign_id: campId,
        created_at: new Date().toISOString(),
      };
      current = [...current, created];
      await route.fulfill({
        status: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(created),
      });
      return;
    }
    if (method === "DELETE") {
      const url = route.request().url();
      const pjId = url.split("/").pop() ?? "";
      current = current.filter((pj) => pj.id !== pjId);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
}

test("GM sees an empty PJ roster and creates the first PJ via the EmptyState CTA", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page, gmCampaign);
  await mockSessionsList(page);
  let capturedBody: unknown = null;
  await mockCampaignPjs(page, {
    initial: [],
    onPost: (body) => {
      capturedBody = body;
    },
  });

  await page.goto(`/jdr/campaigns/${campId}`);
  await expect(
    page.getByRole("heading", { level: 2, name: "Aucun PJ dans cette campagne." }),
  ).toBeVisible();

  // EmptyState CTA + header button both labelled "Ajouter un PJ" → use first.
  await page.getByRole("button", { name: "Ajouter un PJ" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Nouveau PJ" }),
  ).toBeVisible();

  await page.getByLabel("Nom du PJ").fill("Aragorn");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.getByText("Aragorn")).toBeVisible();
  expect((capturedBody as { name?: string; campaign_id?: string } | null)?.name).toBe(
    "Aragorn",
  );
  expect(
    (capturedBody as { campaign_id?: string } | null)?.campaign_id,
  ).toBe(campId);
});

test("GM creates a second PJ via the header button and it appears in the list", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page, gmCampaign);
  await mockSessionsList(page);
  await mockCampaignPjs(page, {
    initial: [
      {
        id: "pj-1",
        name: "Aragorn",
        campaign_id: campId,
        created_at: "2026-05-30T10:00:00Z",
      },
    ],
  });

  await page.goto(`/jdr/campaigns/${campId}`);
  await expect(page.getByText("Aragorn")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un PJ" }).click();
  await page.getByLabel("Nom du PJ").fill("Legolas");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.getByText("Legolas")).toBeVisible();
});

test("GM deletes a PJ from the campaign roster (mocked V1 — disappears locally)", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page, gmCampaign);
  await mockSessionsList(page);
  await mockCampaignPjs(page, {
    initial: [
      {
        id: "pj-1",
        name: "Aragorn",
        campaign_id: campId,
        created_at: "2026-05-30T10:00:00Z",
      },
    ],
  });

  await page.goto(`/jdr/campaigns/${campId}`);
  await page
    .getByRole("button", { name: "Supprimer le PJ Aragorn" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Supprimer Aragorn ?" }),
  ).toBeVisible();
  await page.getByLabel(/pour confirmer/i).fill("Aragorn");
  await page.getByRole("button", { name: "Supprimer le PJ" }).click();

  await expect(page.getByText("Aragorn")).not.toBeVisible();
});

test("PJ user sees the roster but no Ajouter / Supprimer buttons", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page, pjCampaign);
  await mockSessionsList(page);
  await mockCampaignPjs(page, {
    initial: [
      {
        id: "pj-1",
        name: "Aragorn",
        campaign_id: campId,
        created_at: "2026-05-30T10:00:00Z",
      },
    ],
  });

  await page.goto(`/jdr/campaigns/${campId}`);
  await expect(page.getByText("Aragorn")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ajouter un PJ" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Supprimer le PJ/ }),
  ).not.toBeVisible();
});
