import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  loginAsGM,
  mockCampaignsList,
} from "../helpers/mocks";

test("logout then re-login lands back on /jdr/campaigns (no infinite loop, no stuck on /login)", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);
  await mockCampaignsList(page, []);

  // Step 1: log in
  await page.goto("/login");
  await loginAsGM(page);
  await expect(page).toHaveURL(/\/jdr\/campaigns/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).toBeVisible();

  // Step 2: log out
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();

  // Step 3: re-login. Sentinel cache from logout must not survive
  // (LoginForm.onSuccess invalidates the session query — Story 1.12 fix).
  await loginAsGM(page);

  await expect(page).toHaveURL(/\/jdr\/campaigns/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).toBeVisible();
  // Admin GM sees the Utilisateurs button in the sidebar FOOTER (Story 2.6).
  await expect(
    page.getByRole("button", { name: /Utilisateurs/i }),
  ).toBeVisible();
});
