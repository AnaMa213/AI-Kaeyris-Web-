import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createSessionState, installAuthMocks } from "../helpers/mocks";

interface PjStore {
  items: { id: string; name: string; created_at: string }[];
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
    await route.continue();
  });

  // V1 mock: DELETE returns 204 without touching the store, so a refresh
  // would restore the PJ. The test asserts the local-only filter behavior.
  await page.route("**/services/jdr/pjs/*", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });
}

test("GM deletes a PJ from the roster (mocked V1) and the row disappears locally", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  const pjStore: PjStore = {
    items: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Eldrin",
        created_at: "2026-05-30T10:00:00Z",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Galadriel",
        created_at: "2026-04-15T14:30:00Z",
      },
    ],
  };
  await mockPjs(page, pjStore);

  await page.goto("/jdr/pjs");

  // Both PJs are visible to start with.
  await expect(page.getByText("Eldrin")).toBeVisible();
  await expect(page.getByText("Galadriel")).toBeVisible();

  // Open the delete dialog for Eldrin.
  await page
    .getByRole("button", { name: "Supprimer le PJ Eldrin" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Supprimer Eldrin ?" }),
  ).toBeVisible();

  // Type the name to enable the destructive button, then confirm.
  await page.getByLabel(/Tape/i).fill("Eldrin");
  await page.getByRole("button", { name: "Supprimer le PJ" }).click();

  // Eldrin disappears from the local cache; Galadriel stays.
  await expect(page.getByText("Eldrin")).not.toBeVisible();
  await expect(page.getByText("Galadriel")).toBeVisible();
});
