import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  mockCampaignCreate,
  mockCampaignsList,
} from "../helpers/mocks";

const newCampaign = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Les Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire.",
  role: "gm" as const,
  session_count: 0,
  last_session_at: null,
  created_at: "2026-05-31T18:05:00+00:00",
};

test("GM lands on /jdr/campaigns with no campaigns and sees the EmptyState", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignsList(page, []);

  await page.goto("/jdr/campaigns");
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).toBeVisible();
  await expect(page.getByText("Aucune campagne encore.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nouvelle campagne" }).first(),
  ).toBeEnabled();
});

test("GM creates a campaign and lands on /jdr/campaigns/{id}", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);

  // Note: mockCampaignCreate registers a POST handler on the same URL.
  // Playwright dispatches by method automatically.
  await mockCampaignsList(page, []);
  await mockCampaignCreate(page, newCampaign);

  await page.goto("/jdr/campaigns/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Nouvelle campagne" }),
  ).toBeVisible();

  await page.getByLabel("Nom").fill("Les Royaumes Brisés");
  await page
    .getByLabel("Description (optionnelle)")
    .fill("Un royaume autrefois uni se déchire.");
  await page.getByRole("button", { name: "Créer la campagne" }).click();

  await expect(page).toHaveURL(new RegExp(`/jdr/campaigns/${newCampaign.id}$`));
});
