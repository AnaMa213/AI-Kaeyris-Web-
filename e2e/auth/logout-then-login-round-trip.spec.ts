import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  loginAsGM,
} from "../helpers/mocks";

test("logout then re-login lands back on /jdr/sessions (no infinite loop, no stuck on /login)", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);

  // Step 1: log in
  await page.goto("/login");
  await loginAsGM(page);
  await expect(page).toHaveURL(/\/jdr\/sessions/);
  await expect(page.getByText("Aucune session encore.")).toBeVisible();

  // Step 2: log out
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();

  // Step 3: re-login with the same credentials. The sentinel cache state
  // from logout must not survive (LoginForm.onSuccess invalidates the
  // session query, see Story 1.12 fix f74db81).
  await loginAsGM(page);

  await expect(page).toHaveURL(/\/jdr\/sessions/);
  await expect(page.getByText("Aucune session encore.")).toBeVisible();
  // GM sees the Utilisateurs nav item (role-based visibility).
  await expect(
    page.getByRole("link", { name: /Utilisateurs/i }),
  ).toBeVisible();
});
