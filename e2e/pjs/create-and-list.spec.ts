import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

const samplePj = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Eldrin",
  created_at: "2026-05-30T10:00:00Z",
};

interface PjStore {
  items: typeof samplePj[];
}

async function mockPjs(page: Page, store: PjStore) {
  await page.route("**/services/jdr/pjs", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: store.items, total: store.items.length }),
      });
      return;
    }
    if (method === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      const created = {
        id: `created-${Date.now()}`,
        name: body.name,
        created_at: new Date().toISOString(),
      };
      store.items.push(created);
      await route.fulfill({
        status: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(created),
      });
      return;
    }
    await route.continue();
  });
}

test("GM can create a PJ from the EmptyState and see it in the roster", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  const pjStore: PjStore = { items: [] };
  await mockPjs(page, pjStore);

  await page.goto("/jdr/pjs");

  // Empty state visible with the EmptyState CTA enabled.
  await expect(
    page.getByText("Aucun PJ dans le grimoire."),
  ).toBeVisible();
  const emptyStateCta = page
    .getByRole("button", { name: "Nouveau PJ" })
    .last();
  await emptyStateCta.click();

  // Dialog opens.
  await expect(
    page.getByRole("heading", { name: "Nouveau PJ" }),
  ).toBeVisible();
  await page.getByLabel("Nom du PJ").fill("Galadriel");
  await page.getByRole("button", { name: "Créer" }).click();

  // PJ appears in the roster.
  await expect(page.getByText("Galadriel")).toBeVisible();
  await expect(
    page.getByText("Aucun PJ dans le grimoire."),
  ).not.toBeVisible();
});

test("GM lands on /jdr/pjs from the sidebar and sees an existing PJ", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  const pjStore: PjStore = { items: [samplePj] };
  await mockPjs(page, pjStore);

  await page.goto("/jdr/sessions");
  await page.getByRole("link", { name: /PJs/i }).click();

  await expect(page).toHaveURL(/\/jdr\/pjs/);
  await expect(
    page.getByRole("heading", { level: 1, name: "PJs" }),
  ).toBeVisible();
  await expect(page.getByText(samplePj.name)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /PJs/i }),
  ).toHaveAttribute("aria-current", "page");
});
