import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  loginAsGM,
  mockCampaignsList,
} from "../helpers/mocks";

test("logout redirects to /login without flashback to /jdr/campaigns even with a slow backend", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session, { logoutDelayMs: 500 });
  await mockCampaignsList(page, []);

  // Bootstrap: log in to land on /jdr/campaigns.
  await page.goto("/login");
  await loginAsGM(page);
  await expect(page).toHaveURL(/\/jdr\/campaigns/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).toBeVisible();

  // Act: click logout. Backend takes 500ms to respond - the redirect
  // MUST happen optimistically (useLogout.onMutate), not waiting.
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  // Within 2s the URL is on /login and the "Campagnes" h1 (which belongs
  // to /jdr/campaigns) is no longer visible.
  await expect(page).toHaveURL(/\/login/, { timeout: 2000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).not.toBeVisible();
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();
});
