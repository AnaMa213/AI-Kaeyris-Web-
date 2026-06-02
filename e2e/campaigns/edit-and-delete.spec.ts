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

const initialCampaign: CampaignFixture = {
  id: campId,
  name: "Les Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire.",
  role: "gm",
  session_count: 0,
  last_session_at: null,
  created_at: "2026-01-12T18:00:00+00:00",
};

async function mockCampaignWithPatchAndDelete(
  page: Page,
  opts: {
    initial: CampaignFixture;
    onPatch?: (body: unknown) => void;
    patchedName?: string;
    patchedDescription?: string | null;
    deleteStatus?: number;
    deleteProblemTitle?: string;
  },
) {
  let current: CampaignFixture = { ...opts.initial };
  await page.route(
    `**/services/jdr/campaigns/${campId}`,
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
          name: opts.patchedName ?? current.name,
          description:
            opts.patchedDescription !== undefined
              ? opts.patchedDescription
              : current.description,
        };
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(current),
        });
        return;
      }
      if (method === "DELETE") {
        const status = opts.deleteStatus ?? 204;
        if (status === 204) {
          await route.fulfill({ status: 204 });
          return;
        }
        await route.fulfill({
          status,
          headers: { "content-type": "application/problem+json" },
          body: JSON.stringify({
            type: "about:blank",
            title: opts.deleteProblemTitle ?? "Conflict",
            status,
          }),
        });
        return;
      }
      await route.continue();
    },
  );
}

async function mockSessionsList(
  page: Page,
  items: Array<Record<string, unknown>>,
) {
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
        body: JSON.stringify({
          items,
          total: items.length,
          page: 1,
          size: 50,
        }),
      });
    },
  );
}

async function mockCampaignsListEmpty(page: Page) {
  await page.route("**/services/jdr/campaigns", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [], total: 0, page: 1, size: 50 }),
    });
  });
}

test("GM edits a campaign name and sees it reflected on the detail page header", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignWithPatchAndDelete(page, {
    initial: initialCampaign,
    patchedName: "Les Royaumes Brisés (V2)",
  });
  await mockSessionsList(page, []);

  await page.goto(`/jdr/campaigns/${campId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Les Royaumes Brisés" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Modifier" }).click();
  await expect(
    page.getByRole("heading", { name: "Modifier la campagne" }),
  ).toBeVisible();

  await page.getByLabel("Nom").fill("Les Royaumes Brisés (V2)");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Les Royaumes Brisés (V2)",
    }),
  ).toBeVisible();
});

test("GM clears the description and the PATCH body sends null", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);

  let capturedBody: unknown = null;
  await mockCampaignWithPatchAndDelete(page, {
    initial: initialCampaign,
    onPatch: (body) => {
      capturedBody = body;
    },
    patchedDescription: null,
  });
  await mockSessionsList(page, []);

  await page.goto(`/jdr/campaigns/${campId}`);
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByLabel(/Description/i).fill("");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("heading", { name: "Modifier la campagne" }),
  ).not.toBeVisible();
  expect(
    (capturedBody as { description?: unknown } | null)?.description,
  ).toBeNull();
});

test("GM deletes an empty campaign and lands on the campaigns list", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignWithPatchAndDelete(page, {
    initial: initialCampaign,
    deleteStatus: 204,
  });
  await mockSessionsList(page, []);
  await mockCampaignsListEmpty(page);

  await page.goto(`/jdr/campaigns/${campId}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(
    page.getByRole("heading", { name: `Supprimer ${initialCampaign.name} ?` }),
  ).toBeVisible();

  await page
    .getByLabel(/pour confirmer/i)
    .fill(initialCampaign.name);
  await page
    .getByRole("button", { name: "Supprimer la campagne" })
    .click();

  await expect(page).toHaveURL(/\/jdr\/campaigns\/?$/);
});

test("DELETE returns 409 because campaign has sessions — Dialog stays open with explicit message", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  const blocked: CampaignFixture = { ...initialCampaign, session_count: 3 };
  await mockCampaignWithPatchAndDelete(page, {
    initial: blocked,
    deleteStatus: 409,
    deleteProblemTitle: "Cannot delete: campaign has sessions",
  });
  await mockSessionsList(page, []);

  await page.goto(`/jdr/campaigns/${campId}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByLabel(/pour confirmer/i).fill(blocked.name);
  await page
    .getByRole("button", { name: "Supprimer la campagne" })
    .click();

  await expect(
    page.getByText(
      /Impossible : cette campagne contient encore 3 sessions\. Supprime-les d'abord\./,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Supprimer ${blocked.name} ?` }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/jdr/campaigns/${campId}$`));
});
