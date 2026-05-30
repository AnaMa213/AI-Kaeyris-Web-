import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  loginAsGM,
} from "../helpers/mocks";

test("logout redirects to /login without flashback to /jdr/sessions even with a slow backend", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session, { logoutDelayMs: 500 });

  // Bootstrap: log in to land on /jdr/sessions.
  await page.goto("/login");
  await loginAsGM(page);
  await expect(page).toHaveURL(/\/jdr\/sessions/);
  await expect(page.getByText("Aucune session encore.")).toBeVisible();

  // Act: click logout. Backend takes 500ms to respond - the redirect
  // MUST happen optimistically (useLogout.onMutate), not waiting.
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  // Within 2s the URL is on /login and the "Aucune session encore." copy
  // (which belongs to /jdr/sessions) is no longer visible.
  await expect(page).toHaveURL(/\/login/, { timeout: 2000 });
  await expect(page.getByText("Aucune session encore.")).not.toBeVisible();
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();
});
