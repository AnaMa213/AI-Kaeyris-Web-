import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  mockCampaignsList,
} from "../helpers/mocks";

test("already-authenticated user visiting /login is redirected to /jdr/campaigns", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignsList(page, []);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/jdr\/campaigns/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).toBeVisible();
  // Story 4.11 — the login credentials form must not be reachable here either.
  await expect(page.getByLabel("Nom d'utilisateur")).toHaveCount(0);
});

test("already-authenticated user visiting /login?from=/jdr/users still lands on /jdr/campaigns (the from is ignored)", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignsList(page, []);

  await page.goto("/login?from=%2Fjdr%2Fusers");

  await expect(page).toHaveURL(/\/jdr\/campaigns/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).toBeVisible();
});
